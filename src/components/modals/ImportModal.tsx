'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Upload, FileText, Check, Loader2, AlertCircle } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';
import { useEditorStore } from '@/store/editorStore';
import type { Requirement } from '@/types';
import type { ImportApplyResult } from '@/lib/import/types';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Phase =
    | 'upload'
    | 'parsing'         // legacy PDF/DOCX client parse
    | 'review'          // legacy review step
    | 'importing'       // legacy import step
    | 'done'            // legacy done
    | 'ai-parsing'      // server AI parse (PDF/DOCX)
    | 'brand-detecting'  // JSON brand detect step
    | 'json-importing'   // JSON content import step
    | 'import-done';     // unified done for AI + JSON paths

interface ExtractedReq {
    text: string;
    shortText: string;
    confidence: 'high' | 'medium' | 'low';
    selected: boolean;
    section?: string;
    sectionName?: string;
    reqId?: string;
}

/** Unified result for AI-parsed and JSON imports */
interface UnifiedImportResult extends ImportApplyResult {
    brandSource?: 'deterministic' | 'ai' | 'server' | 'none';
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
    const [phase, setPhase] = useState<Phase>('upload');
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [extractedReqs, setExtractedReqs] = useState<ExtractedReq[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<UnifiedImportResult | null>(null);
    const fileIdRef = useRef(`file-${Date.now()}`);

    const { importRequirements } = useRequirementsStore();
    const { addSource } = useSourcesStore();

    // Reset modal state every time it opens
    useEffect(() => {
        if (isOpen) {
            setPhase('upload');
            setError(null);
            setImportResult(null);
            setExtractedReqs([]);
        }
    }, [isOpen]);

    // Detect if a document is already loaded (editor has content OR requirements exist)
    const requirements = useRequirementsStore((s) => s.requirements);
    const editor = useEditorStore((s) => s.editor);
    // Track editor emptiness reactively via a state that updates on editor changes
    const [editorEmpty, setEditorEmpty] = useState(true);
    useEffect(() => {
        if (!editor) { setEditorEmpty(true); return; }
        // Check immediately
        setEditorEmpty(editor.isEmpty);
        // Listen for content changes
        const onUpdate = () => setEditorEmpty(editor.isEmpty);
        editor.on('update', onUpdate);
        return () => { editor.off('update', onUpdate); };
    }, [editor]);

    const isLocked = phase === 'upload' && (!editorEmpty || requirements.length > 0);

    // -------------------------------------------------------------------
    // SERVER AI PARSE — PDF / DOCX
    // -------------------------------------------------------------------

    const handleServerParse = useCallback(async (file: File) => {
        setFileName(file.name);
        setFileSize(file.size);
        setPhase('ai-parsing');
        setError(null);
        setImportResult(null);

        try {
            // POST file to our server route
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/import/parse', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({ error: 'Server error' }));
                throw new Error(errBody.error || `Server returned ${res.status}`);
            }

            const payload = await res.json();

            // Apply using shared utility
            const { applyNormalizedImport } = await import('@/lib/import/applyNormalizedImport');
            const result = applyNormalizedImport(payload, {
                filename: file.name,
                fileSize: file.size,
            });

            setImportResult({ ...result, brandSource: 'server' });
            setPhase('import-done');
        } catch (err) {
            console.error('[ImportModal] Server parse error:', err);
            const message = err instanceof Error ? err.message : 'Failed to parse document';

            // Fallback: try legacy client-side parse for PDF/DOCX
            const ext = file.name.toLowerCase().split('.').pop();
            if (ext === 'pdf' || ext === 'docx') {
                console.warn('[ImportModal] Falling back to legacy client-side parse');
                handleLegacyDocumentImport(file);
            } else {
                setError(message);
                setPhase('upload');
            }
        }
    }, []);

    // -------------------------------------------------------------------
    // JSON Import Handler (brand + content + requirements)
    // -------------------------------------------------------------------

    const handleJsonImport = useCallback(async (file: File) => {
        setFileName(file.name);
        setFileSize(file.size);
        setPhase('brand-detecting');
        setError(null);
        setImportResult(null);

        try {
            const rawJson = await file.text();

            // Phase A: Brand style extraction
            const { extractBrandFromJson, hasMeaningfulFields } = await import('@/lib/brand/extractBrandFromJson');
            const extracted = extractBrandFromJson(rawJson);

            let brand = extracted;
            let brandSource: 'deterministic' | 'ai' | 'none' = 'none';

            if (hasMeaningfulFields(extracted)) {
                brandSource = 'deterministic';
            } else {
                try {
                    const res = await fetch('/api/brand-detect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jsonContent: rawJson.slice(0, 20000) }),
                    });
                    if (res.ok) {
                        const { validateBrand } = await import('@/lib/brand/extractBrandFromJson');
                        const aiBrand = validateBrand(await res.json());
                        if (hasMeaningfulFields(aiBrand)) {
                            brand = aiBrand;
                            brandSource = 'ai';
                        }
                    }
                } catch {
                    // Silent fallback
                }
            }

            // Phase B: Build normalized payload and apply
            setPhase('json-importing');

            const { extractContentFromJson } = await import('@/lib/brand/extractContentFromJson');
            const contentResult = extractContentFromJson(rawJson);

            // Build NormalizedImportPayload
            const payload = {
                brand: {
                    fontFamily: brand.fontFamily,
                    fontSize: brand.fontSize,
                    lineHeight: brand.lineHeight,
                    spaceBefore: brand.spaceBefore,
                    spaceAfter: brand.spaceAfter,
                    h1Color: brand.h1Color,
                    h2Color: brand.h2Color,
                    bodyColor: brand.bodyColor,
                    h1FontSize: null as number | null,
                    h2FontSize: null as number | null,
                },
                document: contentResult.doc,
                requirements: contentResult.requirements.map(r => ({
                    id: r.id,
                    text: r.text,
                    section: r.section ?? null,
                    priority: r.priority ?? null,
                })),
            };

            const { applyNormalizedImport } = await import('@/lib/import/applyNormalizedImport');
            const result = applyNormalizedImport(payload, {
                filename: file.name,
                fileSize: file.size,
            });

            setImportResult({ ...result, brandSource });
            setPhase('import-done');
        } catch (err) {
            console.error('[ImportModal] JSON import error:', err);
            setError(err instanceof Error ? err.message : 'Failed to process JSON file');
            setPhase('upload');
        }
    }, []);

    // -------------------------------------------------------------------
    // Legacy PDF/DOCX Client-side Parse (fallback if server fails)
    // -------------------------------------------------------------------

    const handleLegacyDocumentImport = useCallback(async (file: File) => {
        setFileName(file.name);
        setFileSize(file.size);
        setPhase('parsing');
        setError(null);

        try {
            const { generateFileId } = await import('@/lib/parsers/classifier');
            fileIdRef.current = generateFileId({ name: file.name, size: file.size, lastModified: file.lastModified });

            const isPDF = file.name.toLowerCase().endsWith('.pdf');

            let blocks: { text: string; blockId: string; pageNumber: number }[] = [];

            if (isPDF) {
                const { parsePDFToBlocks } = await import('@/lib/parsers/pdfParser');
                blocks = await parsePDFToBlocks(file);
            } else {
                const { parseDOCXToBlocks } = await import('@/lib/parsers/docxParser');
                blocks = await parseDOCXToBlocks(file);
            }

            const paragraphs = blocks.map(block => ({
                text: block.text,
                pageNumber: block.pageNumber,
                blockId: block.blockId,
            }));

            const { extractRequirements } = await import('@/lib/parsers/classifier');
            const classified = extractRequirements(paragraphs);

            const extracted: ExtractedReq[] = classified.map((req) => ({
                text: req.text,
                shortText: req.shortText,
                confidence: req.confidence,
                selected: req.confidence !== 'low',
                section: req.section,
                sectionName: req.sectionName,
                reqId: req.reqId,
            }));

            setExtractedReqs(extracted);
            setPhase('review');
        } catch (err) {
            console.error('Legacy import error:', err);
            setError(err instanceof Error ? err.message : 'Failed to parse file');
            setPhase('upload');
        }
    }, []);

    // -------------------------------------------------------------------
    // Unified Upload Router
    // -------------------------------------------------------------------

    const handleFileUpload = useCallback(async (file: File) => {
        const ext = file.name.toLowerCase().split('.').pop();

        if (ext === 'json') {
            handleJsonImport(file);
        } else if (ext === 'pdf' || ext === 'docx') {
            // Primary path: server AI parse
            handleServerParse(file);
        } else {
            setError('Supported formats: PDF, DOCX, JSON');
            setPhase('upload');
        }
    }, [handleJsonImport, handleServerParse]);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload(file);
        },
        [handleFileUpload]
    );

    const toggleSelection = (index: number) => {
        setExtractedReqs((prev) =>
            prev.map((req, i) => (i === index ? { ...req, selected: !req.selected } : req))
        );
    };

    // Legacy review → import flow
    const handleLegacyImport = () => {
        setPhase('importing');

        const selectedReqs = extractedReqs.filter((r) => r.selected);
        const fileId = fileIdRef.current;

        const requirements: Requirement[] = selectedReqs.map((req, i) => ({
            id: req.reqId || `req-${Date.now()}-${i}`,
            text: req.shortText || req.text.slice(0, 50) + (req.text.length > 50 ? '...' : ''),
            originalText: req.text,
            sectionPath: req.sectionName ? [req.sectionName] : ['Uncategorized'],
            status: 'unlinked',
            kanbanStatus: 'to_address',
            priority: req.confidence === 'high' ? 'mandatory' : 'desired',
            linkedBlockIds: [],
            source: { fileId, filename: fileName },
            importedAt: Date.now(),
        }));

        addSource({
            id: fileId,
            filename: fileName,
            fileSize: fileSize,
            importedAt: Date.now(),
            requirementCount: requirements.length,
        });

        importRequirements(requirements);

        setTimeout(() => {
            setPhase('done');
        }, 500);
    };

    const getConfidenceColor = (confidence: string) => {
        switch (confidence) {
            case 'high':
                return 'text-[#3fb950] bg-[#3fb95022]';
            case 'medium':
                return 'text-[#d29922] bg-[#d2992222]';
            default:
                return 'text-[#8b949e] bg-[#8b949e22]';
        }
    };

    const getBrandSourceLabel = (src?: string) => {
        switch (src) {
            case 'server': return 'AI-detected';
            case 'ai': return 'AI';
            case 'deterministic': return 'direct';
            default: return '';
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay ${isOpen ? 'modal-open' : ''}`}>
            <div className="w-full max-w-2xl bg-[#161b22] rounded-lg shadow-2xl border border-[#30363d] modal-panel">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
                    <h2 className="text-lg font-semibold text-[#c9d1d9]">Import RFP Document</h2>
                    <button onClick={onClose} className="p-1 hover:bg-[#21262d] rounded transition-colors">
                        <X size={18} className="text-[#8b949e]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Upload Phase */}
                    {phase === 'upload' && (
                        <div
                            onDrop={isLocked ? undefined : handleDrop}
                            onDragOver={isLocked ? undefined : (e) => e.preventDefault()}
                            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${isLocked ? 'border-[#30363d] opacity-60' : 'border-[#30363d] hover:border-[#388bfd]'}`}
                        >
                            {isLocked ? (
                                <>
                                    <AlertCircle size={48} className="mx-auto text-[#d29922] mb-4" />
                                    <p className="text-[#c9d1d9] mb-2">A document is already loaded.</p>
                                    <p className="text-sm text-[#8b949e] mb-4">
                                        Press <span className="text-[#c9d1d9] font-medium">Clear All</span> first to import a new document.
                                    </p>
                                    <button
                                        onClick={onClose}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] rounded-lg text-sm text-[#c9d1d9] font-medium transition-colors"
                                    >
                                        Close
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Upload size={48} className="mx-auto text-[#8b949e] mb-4" />
                                    <p className="text-[#c9d1d9] mb-2">Drag & drop your RFP document here</p>
                                    <p className="text-sm text-[#8b949e] mb-4">Supports PDF, DOCX, and JSON files</p>
                                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm text-white font-medium cursor-pointer transition-colors">
                                        <FileText size={16} />
                                        Browse Files
                                        <input
                                            type="file"
                                            accept=".pdf,.docx,.json"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileUpload(file);
                                            }}
                                        />
                                    </label>
                                    {error && (
                                        <div className="mt-4 flex items-center justify-center gap-2 text-[#f85149]">
                                            <AlertCircle size={16} />
                                            <span className="text-sm">{error}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* AI Parsing Phase (PDF/DOCX via server) */}
                    {phase === 'ai-parsing' && (
                        <div className="text-center py-12">
                            <Loader2 size={48} className="mx-auto text-[#388bfd] animate-spin mb-4" />
                            <p className="text-[#c9d1d9]">Parsing document with AI...</p>
                            <p className="text-sm text-[#8b949e]">Extracting content, requirements, and brand styles from {fileName}</p>
                        </div>
                    )}

                    {/* Brand Detecting Phase (JSON step 1) */}
                    {phase === 'brand-detecting' && (
                        <div className="text-center py-12">
                            <Loader2 size={48} className="mx-auto text-[#d29922] animate-spin mb-4" />
                            <p className="text-[#c9d1d9]">Analyzing company brand styles...</p>
                            <p className="text-sm text-[#8b949e]">Extracting typography rules from {fileName}</p>
                        </div>
                    )}

                    {/* JSON Importing Phase (JSON step 2) */}
                    {phase === 'json-importing' && (
                        <div className="text-center py-12">
                            <Loader2 size={48} className="mx-auto text-[#388bfd] animate-spin mb-4" />
                            <p className="text-[#c9d1d9]">Importing document content...</p>
                            <p className="text-sm text-[#8b949e]">Loading content and requirements from {fileName}</p>
                        </div>
                    )}

                    {/* Legacy Parsing Phase (client-side fallback) */}
                    {phase === 'parsing' && (
                        <div className="text-center py-12">
                            <Loader2 size={48} className="mx-auto text-[#388bfd] animate-spin mb-4" />
                            <p className="text-[#c9d1d9]">Parsing {fileName}...</p>
                            <p className="text-sm text-[#8b949e]">Extracting requirements (local)</p>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* UNIFIED DONE — for AI-parsed and JSON imports               */}
                    {/* ============================================================ */}
                    {phase === 'import-done' && importResult && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto bg-[#3fb95022] rounded-full flex items-center justify-center mb-4">
                                <Check size={32} className="text-[#3fb950]" />
                            </div>
                            <p className="text-[#c9d1d9] mb-1 text-lg font-medium">
                                Import complete
                            </p>

                            <div className="max-w-sm mx-auto my-4 text-left bg-[#21262d] rounded-lg p-3 space-y-1.5">
                                {/* Document content */}
                                <div className="flex items-center gap-2 text-sm">
                                    {importResult.documentLoaded
                                        ? <Check size={14} className="text-[#3fb950] flex-shrink-0" />
                                        : <AlertCircle size={14} className="text-[#8b949e] flex-shrink-0" />
                                    }
                                    <span className={importResult.documentLoaded ? 'text-[#c9d1d9]' : 'text-[#8b949e]'}>
                                        {importResult.documentLoaded ? 'Document content loaded into editor' : 'No document content found'}
                                    </span>
                                </div>

                                {/* Requirements */}
                                <div className="flex items-center gap-2 text-sm">
                                    {importResult.requirementsCount > 0
                                        ? <Check size={14} className="text-[#3fb950] flex-shrink-0" />
                                        : <AlertCircle size={14} className="text-[#8b949e] flex-shrink-0" />
                                    }
                                    <span className={importResult.requirementsCount > 0 ? 'text-[#c9d1d9]' : 'text-[#8b949e]'}>
                                        {importResult.requirementsCount > 0
                                            ? `${importResult.requirementsCount} requirement${importResult.requirementsCount === 1 ? '' : 's'} imported`
                                            : 'No requirements found'}
                                    </span>
                                </div>

                                {/* Brand styles */}
                                {importResult.brandFields.length > 0 && (
                                    <>
                                        <div className="border-t border-[#30363d] my-1.5" />
                                        <p className="text-xs text-[#8b949e] mb-1">
                                            Brand styles ({getBrandSourceLabel(importResult.brandSource)}):
                                        </p>
                                        {importResult.brandFields.map((field, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm">
                                                <Check size={14} className="text-[#3fb950] flex-shrink-0" />
                                                <span className="text-[#c9d1d9]">{field}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm text-white font-medium transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* LEGACY REVIEW FLOW (client-side PDF/DOCX fallback)          */}
                    {/* ============================================================ */}
                    {phase === 'review' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-[#8b949e]">
                                    Found <span className="text-[#c9d1d9] font-medium">{extractedReqs.length}</span> potential requirements
                                </p>
                                <p className="text-sm text-[#8b949e]">
                                    Selected: {extractedReqs.filter((r) => r.selected).length}
                                </p>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4">
                                {extractedReqs.map((req, i) => (
                                    <div
                                        key={i}
                                        onClick={() => toggleSelection(i)}
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${req.selected ? 'bg-[#388bfd22] border border-[#388bfd]' : 'bg-[#21262d] hover:bg-[#30363d]'
                                            }`}
                                    >
                                        <div
                                            className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center ${req.selected ? 'bg-[#388bfd] border-[#388bfd]' : 'border-[#30363d]'
                                                }`}
                                        >
                                            {req.selected && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[#c9d1d9] line-clamp-2">{req.text}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs ${getConfidenceColor(req.confidence)}`}>
                                            {req.confidence}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setPhase('upload')}
                                    className="px-4 py-2 text-sm text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleLegacyImport}
                                    disabled={extractedReqs.filter((r) => r.selected).length === 0}
                                    className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
                                >
                                    Import {extractedReqs.filter((r) => r.selected).length} Requirements
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Legacy Importing Phase */}
                    {phase === 'importing' && (
                        <div className="text-center py-12">
                            <Loader2 size={48} className="mx-auto text-[#388bfd] animate-spin mb-4" />
                            <p className="text-[#c9d1d9]">Importing requirements...</p>
                        </div>
                    )}

                    {/* Legacy Done Phase */}
                    {phase === 'done' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-[#3fb95022] rounded-full flex items-center justify-center mb-4">
                                <Check size={32} className="text-[#3fb950]" />
                            </div>
                            <p className="text-[#c9d1d9] mb-2">Import Complete!</p>
                            <p className="text-sm text-[#8b949e] mb-6">
                                {extractedReqs.filter((r) => r.selected).length} requirements imported
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm text-white font-medium transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

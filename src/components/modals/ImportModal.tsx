'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Upload, FileText, Check, Loader2, AlertCircle } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';
import type { Requirement } from '@/types';

interface ImportModalProps {
    onClose: () => void;
}

type Phase = 'upload' | 'parsing' | 'review' | 'importing' | 'done';

interface ExtractedReq {
    text: string;
    shortText: string;
    confidence: 'high' | 'medium' | 'low';
    selected: boolean;
    section?: string;
    sectionName?: string;
    reqId?: string;
}

export default function ImportModal({ onClose }: ImportModalProps) {
    const [phase, setPhase] = useState<Phase>('upload');
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [extractedReqs, setExtractedReqs] = useState<ExtractedReq[]>([]);
    const [error, setError] = useState<string | null>(null);
    const fileIdRef = useRef(`file-${Date.now()}`);

    const { importRequirements } = useRequirementsStore();
    const { addSource } = useSourcesStore();

    const handleFileUpload = useCallback(async (file: File) => {
        setFileName(file.name);
        setFileSize(file.size);
        setPhase('parsing');
        setError(null);

        try {
            // Generate stable file ID from content
            const { generateFileId } = await import('@/lib/parsers/classifier');
            fileIdRef.current = generateFileId({ name: file.name, size: file.size, lastModified: file.lastModified });

            // Dynamically import parsers to avoid SSR issues
            const isPDF = file.name.toLowerCase().endsWith('.pdf');
            const isDOCX = file.name.toLowerCase().endsWith('.docx');

            if (!isPDF && !isDOCX) {
                throw new Error('Only PDF and DOCX files are supported');
            }

            // Use new sentence-level block parsing for better granularity
            let blocks: { text: string; blockId: string; pageNumber: number }[] = [];

            if (isPDF) {
                const { parsePDFToBlocks } = await import('@/lib/parsers/pdfParser');
                blocks = await parsePDFToBlocks(file);
            } else {
                const { parseDOCXToBlocks } = await import('@/lib/parsers/docxParser');
                blocks = await parseDOCXToBlocks(file);
            }

            // Convert blocks to paragraph format for classifier compatibility
            const paragraphs = blocks.map(block => ({
                text: block.text,
                pageNumber: block.pageNumber,
                blockId: block.blockId,
            }));

            // Classify paragraphs as requirements
            const { extractRequirements } = await import('@/lib/parsers/classifier');
            const classified = extractRequirements(paragraphs);

            // Convert to ExtractedReq format - preserve section info from classifier
            const extracted: ExtractedReq[] = classified.map((req) => ({
                text: req.text,
                shortText: req.shortText,
                confidence: req.confidence,
                selected: req.confidence !== 'low', // Auto-select high/medium
                section: req.section,
                sectionName: req.sectionName,
                reqId: req.reqId,
            }));

            setExtractedReqs(extracted);
            setPhase('review');
        } catch (err) {
            console.error('Import error:', err);
            setError(err instanceof Error ? err.message : 'Failed to parse file');
            setPhase('upload');
        }
    }, []);

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

    const handleImport = () => {
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

        // Save source file
        addSource({
            id: fileId,
            filename: fileName,
            fileSize: fileSize,
            importedAt: Date.now(),
            requirementCount: requirements.length,
        });

        // Import requirements
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-2xl bg-[#161b22] rounded-lg shadow-2xl border border-[#30363d]">
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
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="border-2 border-dashed border-[#30363d] rounded-lg p-12 text-center hover:border-[#388bfd] transition-colors"
                        >
                            <Upload size={48} className="mx-auto text-[#8b949e] mb-4" />
                            <p className="text-[#c9d1d9] mb-2">Drag & drop your RFP document here</p>
                            <p className="text-sm text-[#8b949e] mb-4">Supports PDF and DOCX files</p>
                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm text-white font-medium cursor-pointer transition-colors">
                                <FileText size={16} />
                                Browse Files
                                <input
                                    type="file"
                                    accept=".pdf,.docx"
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
                        </div>
                    )}

                    {/* Parsing Phase */}
                    {phase === 'parsing' && (
                        <div className="text-center py-12">
                            <Loader2 size={48} className="mx-auto text-[#388bfd] animate-spin mb-4" />
                            <p className="text-[#c9d1d9]">Parsing {fileName}...</p>
                            <p className="text-sm text-[#8b949e]">Extracting requirements</p>
                        </div>
                    )}

                    {/* Review Phase */}
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
                                    onClick={handleImport}
                                    disabled={extractedReqs.filter((r) => r.selected).length === 0}
                                    className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
                                >
                                    Import {extractedReqs.filter((r) => r.selected).length} Requirements
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Importing Phase */}
                    {phase === 'importing' && (
                        <div className="text-center py-12">
                            <Loader2 size={48} className="mx-auto text-[#388bfd] animate-spin mb-4" />
                            <p className="text-[#c9d1d9]">Importing requirements...</p>
                        </div>
                    )}

                    {/* Done Phase */}
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

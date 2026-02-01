'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Type, BookOpen, CheckCircle, XCircle, AlertTriangle, FileText, Trash2, ChevronDown, Minus, Plus } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useSourcesStore } from '@/store/sourcesStore';
import { useStyleStore } from '@/store/styleStore';

type Tab = 'scan' | 'styles' | 'sources';

interface ScanResult {
    score: number;
    issues: { type: 'warning' | 'error' | 'success'; message: string }[];
}

const FONTS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Georgia', 'Times New Roman'];

// Number input with +/- buttons
function NumberInput({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    unit = ''
}: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
}) {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
                className="w-7 h-7 flex items-center justify-center bg-[#21262d] hover:bg-[#30363d] rounded transition-colors"
            >
                <Minus size={12} className="text-[#8b949e]" />
            </button>
            <div className="w-12 h-7 flex items-center justify-center bg-[#21262d] rounded text-sm text-[#c9d1d9]">
                {step < 1 ? value.toFixed(1) : value}
            </div>
            <button
                onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
                className="w-7 h-7 flex items-center justify-center bg-[#21262d] hover:bg-[#30363d] rounded transition-colors"
            >
                <Plus size={12} className="text-[#8b949e]" />
            </button>
            {unit && <span className="text-xs text-[#8b949e] ml-1">{unit}</span>}
        </div>
    );
}

export default function RightSidebar() {
    const [activeTab, setActiveTab] = useState<Tab>('scan');
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [showFontDropdown, setShowFontDropdown] = useState(false);
    const [hasContent, setHasContent] = useState(false);

    const editor = useEditorStore((state) => state.editor);
    const { sources, removeSource } = useSourcesStore();

    // Track editor content changes
    useEffect(() => {
        if (!editor) return;

        const updateHasContent = () => {
            const text = editor.getText().trim();
            setHasContent(text.length > 0);
        };

        // Initial check
        updateHasContent();

        // Listen for updates
        editor.on('update', updateHasContent);

        return () => {
            editor.off('update', updateHasContent);
        };
    }, [editor]);

    // Style store - all style values and setters
    const {
        fontFamily, setFontFamily,
        fontSize, setFontSize,
        lineHeight, setLineHeight,
        spaceBefore, setSpaceBefore,
        spaceAfter, setSpaceAfter,
        firstLineIndent, setFirstLineIndent
    } = useStyleStore();

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Handle font change - also apply to editor selection
    const handleFontChange = (font: string) => {
        setFontFamily(font);
        setShowFontDropdown(false);
        if (editor) {
            editor.chain().focus().setFontFamily(font).run();
        }
    };

    // Handle preset with editor command - ONLY affects current paragraph (where cursor is)
    const handlePreset = (preset: 'h1' | 'h2' | 'body' | 'caption') => {
        if (!editor) return;

        // Get current cursor position before any focus changes
        const { from } = editor.state.selection;

        // Use setHeading (not toggleHeading) to prevent toggling back to paragraph
        switch (preset) {
            case 'h1':
                editor.chain().focus().setTextSelection(from).setHeading({ level: 1 }).run();
                break;
            case 'h2':
                editor.chain().focus().setTextSelection(from).setHeading({ level: 2 }).run();
                break;
            case 'body':
            case 'caption':
                editor.chain().focus().setTextSelection(from).setParagraph().run();
                break;
        }
    };

    const runScan = () => {
        if (!editor) return;

        setIsScanning(true);
        setScanResult(null);

        setTimeout(() => {
            const text = editor.getText();
            const wordCount = text.split(/\s+/).filter(Boolean).length;
            const issues: ScanResult['issues'] = [];

            if (wordCount < 100) {
                issues.push({ type: 'warning', message: 'Document is short (less than 100 words)' });
            } else {
                issues.push({ type: 'success', message: `Document has ${wordCount} words` });
            }

            if (text.toLowerCase().includes('executive summary')) {
                issues.push({ type: 'success', message: 'Executive Summary found' });
            } else {
                issues.push({ type: 'error', message: 'Missing Executive Summary section' });
            }

            if (text.toLowerCase().includes('technical approach')) {
                issues.push({ type: 'success', message: 'Technical Approach found' });
            } else {
                issues.push({ type: 'warning', message: 'Consider adding Technical Approach' });
            }

            const successCount = issues.filter((i) => i.type === 'success').length;
            const score = Math.round((successCount / issues.length) * 100);

            setScanResult({ score, issues });
            setIsScanning(false);
        }, 1500);
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-[#3fb950]';
        if (score >= 50) return 'text-[#d29922]';
        return 'text-[#f85149]';
    };

    return (
        <aside className="w-[280px] flex-shrink-0 bg-[#161b22] border-l border-[#30363d] flex flex-col h-full">
            {/* Tabs */}
            <div className="flex border-b border-[#21262d]">
                <button
                    onClick={() => setActiveTab('scan')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === 'scan'
                        ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                        : 'text-[#8b949e] hover:text-[#c9d1d9]'
                        }`}
                >
                    <Sparkles size={12} />
                    Scan
                </button>
                <button
                    onClick={() => setActiveTab('styles')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === 'styles'
                        ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                        : 'text-[#8b949e] hover:text-[#c9d1d9]'
                        }`}
                >
                    <Type size={12} />
                    Styles
                </button>
                <button
                    onClick={() => setActiveTab('sources')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === 'sources'
                        ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                        : 'text-[#8b949e] hover:text-[#c9d1d9]'
                        }`}
                >
                    <BookOpen size={12} />
                    Sources
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-4 overflow-y-auto">
                {activeTab === 'scan' && (
                    <div>
                        <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">
                            Quality Scanner
                        </h3>
                        <p className="text-xs text-[#8b949e] mb-4">
                            Analyze document for quality and completeness
                        </p>

                        {/* Check if editor has content */}
                        {!hasContent && sources.length === 0 ? (
                            // Empty state - no content and no sources
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto bg-[#21262d] rounded-full flex items-center justify-center mb-4">
                                    <Sparkles size={20} className="text-[#8b949e]" />
                                </div>
                                <p className="text-sm text-[#8b949e] mb-2">No content to scan</p>
                                <p className="text-xs text-[#6e7681]">
                                    Import an RFP or start writing to enable scanning
                                </p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={runScan}
                                    disabled={isScanning}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
                                >
                                    {isScanning ? (
                                        <>
                                            <Sparkles size={14} className="animate-spin" />
                                            Scanning...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} />
                                            Scan
                                        </>
                                    )}
                                </button>

                                {scanResult && (
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-[#21262d] rounded-lg">
                                            <span className="text-sm text-[#8b949e]">Quality Score</span>
                                            <span className={`text-2xl font-bold ${getScoreColor(scanResult.score)}`}>
                                                {scanResult.score}%
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {scanResult.issues.map((issue, i) => (
                                                <div key={i} className="flex items-start gap-2 p-2 rounded bg-[#21262d]">
                                                    {issue.type === 'success' && <CheckCircle size={14} className="text-[#3fb950] mt-0.5" />}
                                                    {issue.type === 'warning' && <AlertTriangle size={14} className="text-[#d29922] mt-0.5" />}
                                                    {issue.type === 'error' && <XCircle size={14} className="text-[#f85149] mt-0.5" />}
                                                    <span className="text-xs text-[#c9d1d9]">{issue.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'styles' && (
                    <div className="space-y-6">
                        {/* TYPOGRAPHY Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Type size={14} className="text-[#8b949e]" />
                                <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Typography</span>
                            </div>

                            {/* Font Dropdown */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[#c9d1d9]">Font</span>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowFontDropdown(!showFontDropdown)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] rounded text-sm text-[#c9d1d9] transition-colors min-w-[120px] justify-between"
                                    >
                                        {fontFamily}
                                        <ChevronDown size={14} className="text-[#8b949e]" />
                                    </button>
                                    {showFontDropdown && (
                                        <div className="absolute top-full right-0 mt-1 w-full bg-[#21262d] rounded shadow-lg border border-[#30363d] z-10 max-h-48 overflow-y-auto">
                                            {FONTS.map(font => (
                                                <button
                                                    key={font}
                                                    onClick={() => handleFontChange(font)}
                                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-[#30363d] transition-colors ${fontFamily === font ? 'text-[#388bfd]' : 'text-[#c9d1d9]'
                                                        }`}
                                                    style={{ fontFamily: font }}
                                                >
                                                    {font}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Size */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[#c9d1d9]">Size</span>
                                <NumberInput value={fontSize} onChange={setFontSize} min={8} max={72} step={1} />
                            </div>

                            {/* Line Height */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[#c9d1d9]">↕ Line Height</span>
                                <NumberInput value={lineHeight} onChange={setLineHeight} min={1} max={3} step={0.1} />
                            </div>
                        </div>

                        {/* SPACING Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-[#8b949e]">↔</span>
                                <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">Spacing</span>
                            </div>

                            {/* Space Before */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[#c9d1d9]">Space Before</span>
                                <NumberInput value={spaceBefore} onChange={setSpaceBefore} min={0} max={100} step={4} unit="pt" />
                            </div>

                            {/* Space After */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[#c9d1d9]">Space After</span>
                                <NumberInput value={spaceAfter} onChange={setSpaceAfter} min={0} max={100} step={4} unit="pt" />
                            </div>

                            {/* First Line Indent */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[#c9d1d9]">≡ First Line Indent</span>
                                <NumberInput value={firstLineIndent} onChange={setFirstLineIndent} min={0} max={2} step={0.25} unit="in" />
                            </div>
                        </div>

                        {/* PRESETS Section */}
                        <div>
                            <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide block mb-3">Presets</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handlePreset('h1')}
                                    className="px-3 py-2 bg-[#21262d] hover:bg-[#30363d] rounded-full text-sm text-[#c9d1d9] transition-colors"
                                >
                                    Heading 1
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handlePreset('h2')}
                                    className="px-3 py-2 bg-[#21262d] hover:bg-[#30363d] rounded-full text-sm text-[#c9d1d9] transition-colors"
                                >
                                    Heading 2
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handlePreset('body')}
                                    className="px-3 py-2 bg-[#388bfd] hover:bg-[#58a6ff] rounded-full text-sm text-white font-medium transition-colors"
                                >
                                    Body
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handlePreset('caption')}
                                    className="px-3 py-2 bg-[#21262d] hover:bg-[#30363d] rounded-full text-sm text-[#c9d1d9] transition-colors"
                                >
                                    Caption
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'sources' && (
                    <div>
                        <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">
                            Source Documents
                        </h3>

                        {sources.length === 0 ? (
                            <p className="text-xs text-[#8b949e]">
                                No sources added yet. Import an RFP to get started.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {sources.map((source) => (
                                    <div
                                        key={source.id}
                                        className="flex items-start gap-3 p-3 bg-[#21262d] rounded-lg group"
                                    >
                                        <FileText size={16} className="text-[#388bfd] mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[#c9d1d9] truncate">
                                                {source.filename}
                                            </p>
                                            <p className="text-xs text-[#8b949e]">
                                                {formatSize(source.fileSize)} · {source.requirementCount} requirements
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeSource(source.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#f8514922] rounded transition-all"
                                            title="Remove source"
                                        >
                                            <Trash2 size={14} className="text-[#f85149]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}

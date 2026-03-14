'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Type, BookOpen, CheckCircle, XCircle, AlertTriangle, FileText, Trash2, Minus, Plus, Send } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useSourcesStore } from '@/store/sourcesStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useStyleStore } from '@/store/styleStore';
import { useUIStore } from '@/store/uiStore';
import FontPicker from '@/components/FontPicker';
import posthog from 'posthog-js';

type Tab = 'scan' | 'styles' | 'sources' | 'ai';

interface ScanResult {
    score: number;
    issues: { type: 'warning' | 'error' | 'success'; message: string }[];
}

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
                className="w-7 h-7 flex items-center justify-center bg-[#eaeef2] hover:bg-[#d0d7de] rounded transition-colors"
            >
                <Minus size={12} className="text-[#656d76]" />
            </button>
            <div className="w-12 h-7 flex items-center justify-center bg-[#eaeef2] rounded text-sm text-[#1f2328]">
                {step < 1 ? value.toFixed(1) : value}
            </div>
            <button
                onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
                className="w-7 h-7 flex items-center justify-center bg-[#eaeef2] hover:bg-[#d0d7de] rounded transition-colors"
            >
                <Plus size={12} className="text-[#656d76]" />
            </button>
            {unit && <span className="text-xs text-[#656d76] ml-1">{unit}</span>}
        </div>
    );
}

export default function RightSidebar() {
    const [activeTab, setActiveTab] = useState<Tab>('scan');
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [hasContent, setHasContent] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

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

    // Active preset tracking (mirrors FloatingToolbar pattern)
    const [activeStyle, setActiveStyle] = useState('Body');

    useEffect(() => {
        if (!editor) return;
        const update = () => {
            if (editor.isActive('docStyle', { style: 'title' })) {
                setActiveStyle('Title');
                return;
            }
            if (editor.isActive('docStyle', { style: 'subtitle' })) {
                setActiveStyle('Subtitle');
                return;
            }
            for (let l = 1; l <= 6; l++) {
                if (editor.isActive('heading', { level: l })) {
                    setActiveStyle(`H${l}`);
                    return;
                }
            }
            setActiveStyle('Body');
        };
        editor.on('selectionUpdate', update);
        editor.on('transaction', update);
        update();
        return () => {
            editor.off('selectionUpdate', update);
            editor.off('transaction', update);
        };
    }, [editor]);

    // Style store - all style values and setters
    const {
        fontFamily,
        fontSize, setFontSize,
        lineHeight, setLineHeight,
        spaceBefore, setSpaceBefore,
        spaceAfter, setSpaceAfter,
        firstLineIndent, setFirstLineIndent,
        applyPreset,
    } = useStyleStore();

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Active button CSS helper
    const presetClass = (key: string) =>
        `flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-left ${
            activeStyle === key
                ? 'bg-[#3fb950]'
                : 'bg-[#eaeef2] hover:bg-[#d0d7de]'
        }`;

    // Handle preset — applies heading/paragraph/docStyle to current block
    const handlePreset = (preset: string) => {
        if (!editor) return;

        switch (preset) {
            case 'title':
                editor.chain().focus().setDocStyle('title').run();
                applyPreset('title');
                break;
            case 'subtitle':
                editor.chain().focus().setDocStyle('subtitle').run();
                applyPreset('subtitle');
                break;
            case 'h1': editor.chain().focus().setHeading({ level: 1 }).run(); break;
            case 'h2': editor.chain().focus().setHeading({ level: 2 }).run(); break;
            case 'h3': editor.chain().focus().setHeading({ level: 3 }).run(); break;
            case 'h4': editor.chain().focus().setHeading({ level: 4 }).run(); break;
            case 'h5': editor.chain().focus().setHeading({ level: 5 }).run(); break;
            case 'h6': editor.chain().focus().setHeading({ level: 6 }).run(); break;
            default:   editor.chain().focus().setParagraph().run(); break;
        }
    };

    const runScan = async () => {
        if (!editor) return;
        setIsScanning(true);
        setScanResult(null);

        try {
            const proposalText = editor.getText();
            const requirements = useRequirementsStore.getState().requirements
                .map(r => ({ id: r.id, text: r.originalText || r.text, priority: r.priority }));

            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposalText, requirements }),
            });

            const data = await res.json();

            const coverageIssues = (data.rfp_coverage || []).map((r: { id: string; covered: boolean; reason: string }) => {
                const req = requirements.find(req => req.id === r.id);
                const label = req?.text?.slice(0, 70) || r.id;
                return {
                    type: r.covered ? 'success' : 'error',
                    message: r.covered ? `✓ ${label}` : `✗ ${label}`,
                };
            });

            setScanResult({
                score: data.score ?? 0,
                issues: [...coverageIssues, ...(data.quality_issues || [])],
            });
            posthog.capture('quality_scan_run', {
                issues_found: [...coverageIssues, ...(data.quality_issues || [])].filter((i: { type: string }) => i.type !== 'success').length,
            });
        } catch (err) {
            console.error('[Scan] failed:', err);
            setScanResult({ score: 0, issues: [{ type: 'error', message: 'Scan failed. Please try again.' }] });
        } finally {
            setIsScanning(false);
        }
    };

    // External scan trigger (from Toolbar > Tools > Quality Scan)
    const scanTrigger = useUIStore((s) => s.scanTrigger);
    useEffect(() => {
        if (scanTrigger > 0) {
            setActiveTab('scan');
            runScan();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanTrigger]);

    const sendMessage = async () => {
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage = { role: 'user' as const, content: chatInput.trim() };
        const newMessages = [...chatMessages, userMessage];
        setChatMessages(newMessages);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const proposalText = editor?.getText() || '';
            const requirements = useRequirementsStore.getState().requirements
                .map(r => ({ id: r.id, text: r.text, priority: r.priority }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages, proposalText, requirements }),
            });

            const data = await res.json();
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Error occurred.' }]);
        } catch {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get response. Please try again.' }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-[#1a7f37]';
        if (score >= 50) return 'text-[#9a6700]';
        return 'text-[#cf222e]';
    };

    return (
        <aside className="w-[280px] min-w-[280px] flex-shrink-0 bg-[#f6f8fa] border-l border-[#d0d7de] flex flex-col h-full">
            {/* Tabs */}
            <div className="flex border-b border-[#eaeef2]">
                <button
                    onClick={() => setActiveTab('scan')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === 'scan'
                        ? 'text-[#3fb950] border-b-2 border-[#3fb950]'
                        : 'text-[#656d76] hover:text-[#1f2328]'
                        }`}
                >
                    <Sparkles size={12} />
                    Scan
                </button>
                <button
                    onClick={() => setActiveTab('styles')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === 'styles'
                        ? 'text-[#3fb950] border-b-2 border-[#3fb950]'
                        : 'text-[#656d76] hover:text-[#1f2328]'
                        }`}
                >
                    <Type size={12} />
                    Styles
                </button>
                <button
                    onClick={() => setActiveTab('sources')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === 'sources'
                        ? 'text-[#3fb950] border-b-2 border-[#3fb950]'
                        : 'text-[#656d76] hover:text-[#1f2328]'
                        }`}
                >
                    <BookOpen size={12} />
                    Sources
                </button>
                <button
                    onClick={() => setActiveTab('ai')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === 'ai'
                        ? 'text-[#3fb950] border-[#3fb950]'
                        : 'text-[#656d76] border-transparent hover:text-[#1f2328]'
                        }`}
                >
                    <Sparkles size={13} />
                    AI
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-4 overflow-y-auto sidebar-scroll">
                {activeTab === 'scan' && (
                    <div>
                        <h3 className="text-sm font-semibold text-[#1f2328] mb-3">
                            Quality Scanner
                        </h3>
                        <p className="text-xs text-[#656d76] mb-4">
                            Analyze document for quality and completeness
                        </p>

                        {/* Check if editor has content */}
                        {!hasContent && sources.length === 0 ? (
                            // Empty state - no content and no sources
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto bg-[#eaeef2] rounded-full flex items-center justify-center mb-4">
                                    <Sparkles size={20} className="text-[#656d76]" />
                                </div>
                                <p className="text-sm text-[#656d76] mb-2">No content to scan</p>
                                <p className="text-xs text-[#9198a1]">
                                    Import an RFP or start writing to enable scanning
                                </p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={runScan}
                                    disabled={isScanning}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#3fb950] hover:bg-[#4cc764] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
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
                                        <div className="flex items-center justify-between p-3 bg-[#eaeef2] rounded-lg">
                                            <span className="text-sm text-[#656d76]">Quality Score</span>
                                            <span className={`text-2xl font-bold ${getScoreColor(scanResult.score)}`}>
                                                {scanResult.score}%
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {scanResult.issues.map((issue, i) => (
                                                <div key={i} className="flex items-start gap-2 p-2 rounded bg-[#eaeef2]">
                                                    {issue.type === 'success' && <CheckCircle size={14} className="text-[#3fb950] mt-0.5" />}
                                                    {issue.type === 'warning' && <AlertTriangle size={14} className="text-[#9a6700] mt-0.5" />}
                                                    {issue.type === 'error' && <XCircle size={14} className="text-[#cf222e] mt-0.5" />}
                                                    <span className="text-xs text-[#1f2328]">{issue.message}</span>
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
                                <Type size={14} className="text-[#656d76]" />
                                <span className="text-xs font-semibold text-[#656d76] uppercase tracking-wide">Typography</span>
                            </div>

                            {/* Font Picker */}
                            <div className="mb-3">
                                <span className="text-sm text-[#1f2328] block mb-1.5">Font</span>
                                <FontPicker editor={editor} />
                            </div>

                            {/* Size */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[#1f2328]">Size</span>
                                <NumberInput value={fontSize} onChange={setFontSize} min={8} max={72} step={1} />
                            </div>

                            {/* Line Height */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[#1f2328]">↕ Line Height</span>
                                <NumberInput value={lineHeight} onChange={setLineHeight} min={1} max={3} step={0.1} />
                            </div>
                        </div>

                        {/* SPACING Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-[#656d76]">↔</span>
                                <span className="text-xs font-semibold text-[#656d76] uppercase tracking-wide">Spacing</span>
                            </div>

                            {/* Space Before */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[#1f2328]">Space Before</span>
                                <NumberInput value={spaceBefore} onChange={setSpaceBefore} min={0} max={100} step={4} unit="pt" />
                            </div>

                            {/* Space After */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[#1f2328]">Space After</span>
                                <NumberInput value={spaceAfter} onChange={setSpaceAfter} min={0} max={100} step={4} unit="pt" />
                            </div>

                            {/* First Line Indent */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[#1f2328]">≡ First Line Indent</span>
                                <NumberInput value={firstLineIndent} onChange={setFirstLineIndent} min={0} max={2} step={0.25} unit="in" />
                            </div>
                        </div>

                        {/* PRESETS Section */}
                        <div>
                            <span className="text-xs font-semibold text-[#656d76] uppercase tracking-wide block mb-3">Presets</span>
                            <div className="flex flex-col gap-1">
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('title')}
                                    className={presetClass('Title')} title="Title — 32pt Bold">
                                    <span className="text-[13px] font-bold" style={{ fontFamily, color: activeStyle === 'Title' ? '#fff' : '#1f2328' }}>Title</span>
                                    <span className={`text-xs ${activeStyle === 'Title' ? 'text-green-100' : 'text-[#656d76]'}`}>32pt Bold</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('subtitle')}
                                    className={presetClass('Subtitle')} title="Subtitle — 14pt Italic">
                                    <span className="text-[12px] italic" style={{ fontFamily, color: activeStyle === 'Subtitle' ? '#fff' : '#1f2328' }}>Subtitle</span>
                                    <span className={`text-xs ${activeStyle === 'Subtitle' ? 'text-green-100' : 'text-[#656d76]'}`}>14pt Italic</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('h1')}
                                    className={presetClass('H1')}>
                                    <span className="text-[15px] font-bold" style={{ color: activeStyle === 'H1' ? '#fff' : '#13818A' }}>H1</span>
                                    <span className={`text-xs ${activeStyle === 'H1' ? 'text-green-100' : 'text-[#656d76]'}`}>16pt Bold</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('h2')}
                                    className={presetClass('H2')}>
                                    <span className={`text-[13px] font-bold ${activeStyle === 'H2' ? 'text-white' : 'text-[#1f2328]'}`}>H2</span>
                                    <span className={`text-xs ${activeStyle === 'H2' ? 'text-green-100' : 'text-[#656d76]'}`}>14pt Bold</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('h3')}
                                    className={presetClass('H3')}>
                                    <span className={`text-[12px] font-bold italic ${activeStyle === 'H3' ? 'text-white' : 'text-[#1f2328]'}`}>H3</span>
                                    <span className={`text-xs ${activeStyle === 'H3' ? 'text-green-100' : 'text-[#656d76]'}`}>13pt Bold Italic</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('h4')}
                                    className={presetClass('H4')}>
                                    <span className={`text-[11px] ${activeStyle === 'H4' ? 'text-white' : 'text-[#1f2328]'}`}>H4</span>
                                    <span className={`text-xs ${activeStyle === 'H4' ? 'text-green-100' : 'text-[#656d76]'}`}>11pt Callout</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('h5')}
                                    className={presetClass('H5')}>
                                    <span className={`text-[12px] ${activeStyle === 'H5' ? 'text-white' : 'text-[#1f2328]'}`}>H5</span>
                                    <span className={`text-xs ${activeStyle === 'H5' ? 'text-green-100' : 'text-[#656d76]'}`}>12pt Lead</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('h6')}
                                    className={presetClass('H6')}>
                                    <span className={`text-[10px] italic ${activeStyle === 'H6' ? 'text-white' : 'text-[#656d76]'}`}>H6</span>
                                    <span className={`text-xs ${activeStyle === 'H6' ? 'text-green-100' : 'text-[#656d76]'}`}>10pt Caption</span>
                                </button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handlePreset('body')}
                                    className={presetClass('Body')}>
                                    <span className={`text-[12px] font-medium ${activeStyle === 'Body' ? 'text-white' : 'text-[#1f2328]'}`}>Body</span>
                                    <span className={`text-xs ${activeStyle === 'Body' ? 'text-green-100' : 'text-[#656d76]'}`}>12pt Regular</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'sources' && (
                    <div>
                        <h3 className="text-sm font-semibold text-[#1f2328] mb-3">
                            Source Documents
                        </h3>

                        {sources.length === 0 ? (
                            <p className="text-xs text-[#656d76]">
                                No sources added yet. Import an RFP to get started.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {sources.map((source) => (
                                    <div
                                        key={source.id}
                                        className="flex items-start gap-3 p-3 bg-[#eaeef2] rounded-lg group"
                                    >
                                        <FileText size={16} className="text-[#3fb950] mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[#1f2328] truncate">
                                                {source.filename}
                                            </p>
                                            <p className="text-xs text-[#656d76]">
                                                {formatSize(source.fileSize)} · {source.requirementCount} requirements
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeSource(source.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#cf222e22] rounded transition-all"
                                            title="Remove source"
                                        >
                                            <Trash2 size={14} className="text-[#cf222e]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="flex flex-col h-full -m-4">
                        {/* Header */}
                        <div className="p-4 border-b border-[#d0d7de]">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#3fb95020] flex items-center justify-center">
                                    <Sparkles size={14} className="text-[#3fb950]" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-[#1f2328]">AI Assistant</div>
                                    <div className="text-xs text-[#656d76]">Powered by Gemini</div>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {chatMessages.length === 0 && (
                                <div className="text-center py-8">
                                    <Sparkles size={24} className="text-[#3fb950] mx-auto mb-2" />
                                    <p className="text-sm text-[#656d76]">Ask me anything about your proposal</p>
                                    <div className="mt-4 space-y-2">
                                        {[
                                            'Improve my executive summary',
                                            'What requirements am I missing?',
                                            'Make this more persuasive',
                                        ].map(suggestion => (
                                            <button
                                                key={suggestion}
                                                onClick={() => setChatInput(suggestion)}
                                                className="block w-full text-left text-xs px-3 py-2 bg-[#f6f8fa] hover:bg-[#eaeef2] rounded-lg text-[#656d76] transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-[#3fb950] text-white'
                                            : 'bg-[#f6f8fa] text-[#1f2328] border border-[#d0d7de]'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-[#f6f8fa] border border-[#d0d7de] rounded-xl px-3 py-2">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-[#d0d7de]">
                            <div className="flex gap-2">
                                <textarea
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    placeholder="Ask AI to help with your proposal..."
                                    className="flex-1 text-xs border border-[#d0d7de] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#3fb950] text-[#1f2328] placeholder-[#9198a1] bg-white"
                                    rows={2}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!chatInput.trim() || isChatLoading}
                                    className="px-3 py-2 bg-[#3fb950] hover:bg-[#4cc764] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                            {chatMessages.length > 0 && (
                                <button
                                    onClick={() => setChatMessages([])}
                                    className="mt-1 text-xs text-[#9198a1] hover:text-[#656d76]"
                                >
                                    Clear chat
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

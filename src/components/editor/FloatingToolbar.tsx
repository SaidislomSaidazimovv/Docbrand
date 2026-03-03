'use client';

import { useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link2, Code, Square, Sparkles, ChevronDown, Paintbrush, Palette } from 'lucide-react';

interface FloatingToolbarProps {
    editor: Editor | null;
}

export default function FloatingToolbar({ editor }: FloatingToolbarProps) {
    const [showToolbar, setShowToolbar] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [showStyleDropdown, setShowStyleDropdown] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showBoxColorPicker, setShowBoxColorPicker] = useState(false);
    const [, setForceUpdate] = useState(0); // Force re-render for active states
    const toolbarRef = useRef<HTMLDivElement>(null);

    const TEXT_COLORS = [
        '#000000', '#434343', '#666666', '#999999',
        '#DC2626', '#EA580C', '#D97706', '#16A34A',
        '#2563EB', '#7C3AED', '#DB2777', '#0891B2',
    ];

    useEffect(() => {
        if (!editor) return;

        const updateToolbar = () => {
            const { from, to, empty } = editor.state.selection;

            // Hide if no selection
            if (empty || from === to) {
                setShowToolbar(false);
                return;
            }

            // Get selection coordinates
            const { view } = editor;
            const start = view.coordsAtPos(from);
            const end = view.coordsAtPos(to);

            // Position toolbar above selection
            const toolbarWidth = 400; // approximate
            const left = Math.max(10, (start.left + end.left) / 2 - toolbarWidth / 2);
            const top = start.top - 50;

            setPosition({ top: Math.max(10, top), left });
            setShowToolbar(true);

            // Force re-render to update button active states
            setForceUpdate(n => n + 1);
        };

        editor.on('selectionUpdate', updateToolbar);
        editor.on('transaction', updateToolbar); // Also on formatting changes
        editor.on('blur', () => setShowToolbar(false));

        return () => {
            editor.off('selectionUpdate', updateToolbar);
            editor.off('transaction', updateToolbar);
            editor.off('blur', () => setShowToolbar(false));
        };
    }, [editor]);

    if (!editor || !showToolbar) return null;

    // Get current text style
    const getCurrentStyle = () => {
        if (editor.isActive('docStyle', { style: 'title' })) return 'Title';
        if (editor.isActive('docStyle', { style: 'subtitle' })) return 'Subtitle';
        for (let l = 1; l <= 6; l++) {
            if (editor.isActive('heading', { level: l })) return `H${l}`;
        }
        return 'Body';
    };

    const STYLE_OPTIONS: { key: string; label: string; className: string; level?: number; docStyle?: string }[] = [
        { key: 'Title', label: 'Title', className: 'text-[13px] font-bold', docStyle: 'title' },
        { key: 'Subtitle', label: 'Subtitle', className: 'text-[12px] italic', docStyle: 'subtitle' },
        { key: 'H1', label: 'Heading 1', className: 'text-[15px] font-bold', level: 1 },
        { key: 'H2', label: 'Heading 2', className: 'text-[13px] font-bold', level: 2 },
        { key: 'H3', label: 'Heading 3', className: 'text-[12px] font-bold italic', level: 3 },
        { key: 'H4', label: 'Heading 4', className: 'text-[11px]', level: 4 },
        { key: 'H5', label: 'Heading 5', className: 'text-[12px]', level: 5 },
        { key: 'H6', label: 'Heading 6', className: 'text-[10px] italic', level: 6 },
        { key: 'Body', label: 'Body', className: 'text-sm' },
    ];

    const handleStyleChange = (_key: string, level?: number, docStyle?: string) => {
        if (docStyle) {
            editor.chain().focus().setDocStyle(docStyle).run();
        } else if (level) {
            editor.chain().focus().toggleHeading({ level: level as 1|2|3|4|5|6 }).run();
        } else {
            editor.chain().focus().setParagraph().run();
        }
        setShowStyleDropdown(false);
    };

    const handleLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL:', previousUrl);

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div
            ref={toolbarRef}
            className="fixed z-50 flex items-center gap-1 px-2 py-1.5 bg-white rounded-xl shadow-lg border border-gray-200"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(e) => e.preventDefault()}
        >
            {/* Style Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setShowStyleDropdown(!showStyleDropdown)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-sm text-gray-700 font-medium transition-colors"
                >
                    {getCurrentStyle()}
                    <ChevronDown size={14} className="text-gray-400" />
                </button>

                {showStyleDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] z-50">
                        {STYLE_OPTIONS.map((opt) => (
                            <button
                                key={opt.key}
                                onClick={() => handleStyleChange(opt.key, opt.level, opt.docStyle)}
                                className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 ${
                                    getCurrentStyle() === opt.key ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                }`}
                            >
                                <span className={opt.className}>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* Bold */}
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('bold')
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                title="Bold"
            >
                <Bold size={16} strokeWidth={2.5} />
            </button>

            {/* Italic */}
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('italic')
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                title="Italic"
            >
                <Italic size={16} />
            </button>

            {/* Underline */}
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('underline')
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                title="Underline"
            >
                <Underline size={16} />
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* Link */}
            <button
                onClick={handleLink}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('link')
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                title="Link"
            >
                <Link2 size={16} />
            </button>

            {/* Code */}
            <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('code')
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                title="Code"
            >
                <Code size={16} />
            </button>

            {/* Text Color */}
            <div className="relative">
                <button
                    onClick={() => { setShowColorPicker(!showColorPicker); setShowBoxColorPicker(false); }}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors flex flex-col items-center"
                    title="Text Color"
                >
                    <Paintbrush size={14} />
                    <div
                        className="w-3.5 h-1 rounded-sm mt-0.5"
                        style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }}
                    />
                </button>

                {showColorPicker && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50">
                        <div className="grid grid-cols-4 gap-1">
                            {TEXT_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false); }}
                                    className="w-6 h-6 rounded-md border border-gray-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                            className="w-full mt-1.5 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded text-center"
                        >
                            Remove color
                        </button>
                    </div>
                )}
            </div>

            {/* Box */}
            <button
                onClick={() => editor.chain().focus().setCalloutBox('info').run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('calloutBox')
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                title="Convert to Box"
            >
                <Square size={16} />
            </button>

            {/* Box Color (only when inside a callout box) */}
            {editor.isActive('calloutBox') && (
                <div className="relative">
                    <button
                        onClick={() => { setShowBoxColorPicker(!showBoxColorPicker); setShowColorPicker(false); }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-blue-500 transition-colors"
                        title="Box Color"
                    >
                        <Palette size={16} />
                    </button>

                    {showBoxColorPicker && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 min-w-[120px]">
                            {[
                                { label: 'Blue', bg: '#EFF6FF', border: '#3B82F6' },
                                { label: 'Green', bg: '#F0FDF4', border: '#22C55E' },
                                { label: 'Yellow', bg: '#FEFCE8', border: '#EAB308' },
                                { label: 'Red', bg: '#FEF2F2', border: '#EF4444' },
                                { label: 'Purple', bg: '#FAF5FF', border: '#A855F7' },
                                { label: 'Gray', bg: '#F9FAFB', border: '#6B7280' },
                            ].map((opt) => (
                                <button
                                    key={opt.label}
                                    onClick={() => {
                                        editor.chain().focus().updateAttributes('calloutBox', { bgColor: opt.bg, borderColor: opt.border }).run();
                                        setShowBoxColorPicker(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-700"
                                >
                                    <div className="w-4 h-4 rounded border-l-[3px]" style={{ backgroundColor: opt.bg, borderColor: opt.border }} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* AI Button */}
            <button
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 rounded-lg text-sm text-white font-medium transition-colors"
                title="AI Assist"
            >
                <Sparkles size={14} />
                AI
            </button>
        </div>
    );
}

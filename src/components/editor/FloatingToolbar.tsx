'use client';

import { useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link2, Code, Sparkles, ChevronDown } from 'lucide-react';

interface FloatingToolbarProps {
    editor: Editor | null;
}

export default function FloatingToolbar({ editor }: FloatingToolbarProps) {
    const [showToolbar, setShowToolbar] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [showStyleDropdown, setShowStyleDropdown] = useState(false);
    const toolbarRef = useRef<HTMLDivElement>(null);

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
        };

        editor.on('selectionUpdate', updateToolbar);
        editor.on('blur', () => setShowToolbar(false));

        return () => {
            editor.off('selectionUpdate', updateToolbar);
            editor.off('blur', () => setShowToolbar(false));
        };
    }, [editor]);

    if (!editor || !showToolbar) return null;

    // Get current text style
    const getCurrentStyle = () => {
        if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
        if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
        return 'Body';
    };

    const handleStyleChange = (style: string) => {
        switch (style) {
            case 'Heading 1':
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                break;
            case 'Heading 2':
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                break;
            case 'Body':
                editor.chain().focus().setParagraph().run();
                break;
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
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] z-50">
                        <button
                            onClick={() => handleStyleChange('Heading 1')}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${getCurrentStyle() === 'Heading 1' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                }`}
                        >
                            <span className="text-lg font-bold">Heading 1</span>
                        </button>
                        <button
                            onClick={() => handleStyleChange('Heading 2')}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${getCurrentStyle() === 'Heading 2' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                }`}
                        >
                            <span className="text-base font-semibold">Heading 2</span>
                        </button>
                        <button
                            onClick={() => handleStyleChange('Body')}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${getCurrentStyle() === 'Body' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                }`}
                        >
                            Body
                        </button>
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

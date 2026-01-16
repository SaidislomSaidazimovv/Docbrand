'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, Plus, Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Editor } from '@tiptap/react';

interface BlockHandleProps {
    editor: Editor | null;
}

export default function BlockHandle({ editor }: BlockHandleProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [handleTop, setHandleTop] = useState(0);
    const [activeNodePos, setActiveNodePos] = useState<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Track mouse position and find hovered block
    const updateHandlePosition = useCallback((event: MouseEvent) => {
        if (!editor || !wrapperRef.current) return;

        const target = event.target as HTMLElement;
        const proseMirror = wrapperRef.current.querySelector('.ProseMirror');

        if (!proseMirror) {
            console.log('ProseMirror not found');
            return;
        }

        // Check if inside ProseMirror
        if (!proseMirror.contains(target)) {
            setIsVisible(false);
            return;
        }

        // Find block element
        const blockTags = ['P', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'PRE', 'UL', 'OL'];
        let block: HTMLElement | null = target;

        while (block && block !== proseMirror) {
            if (blockTags.includes(block.tagName)) break;
            block = block.parentElement;
        }

        if (block && blockTags.includes(block.tagName)) {
            const wrapperRect = wrapperRef.current.getBoundingClientRect();
            const blockRect = block.getBoundingClientRect();

            // Position relative to wrapper
            const top = blockRect.top - wrapperRect.top;
            setHandleTop(top);
            setIsVisible(true);

            // Get ProseMirror position
            try {
                const pos = editor.view.posAtDOM(block, 0);
                setActiveNodePos(pos);
            } catch {
                setActiveNodePos(null);
            }
        }
    }, [editor]);

    // Setup mousemove listener
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const handleMove = (e: MouseEvent) => updateHandlePosition(e);
        const handleLeave = () => setIsVisible(false);

        wrapper.addEventListener('mousemove', handleMove);
        wrapper.addEventListener('mouseleave', handleLeave);

        return () => {
            wrapper.removeEventListener('mousemove', handleMove);
            wrapper.removeEventListener('mouseleave', handleLeave);
        };
    }, [updateHandlePosition]);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Actions
    const handleDuplicate = () => {
        if (!editor || activeNodePos === null) return;
        const node = editor.state.doc.nodeAt(activeNodePos);
        if (node) {
            editor.chain().focus().insertContentAt(activeNodePos + node.nodeSize, node.toJSON()).run();
        }
        setShowMenu(false);
    };

    const handleDelete = () => {
        if (!editor || activeNodePos === null) return;
        const node = editor.state.doc.nodeAt(activeNodePos);
        if (node) {
            editor.chain().focus().deleteRange({ from: activeNodePos, to: activeNodePos + node.nodeSize }).run();
        }
        setShowMenu(false);
    };

    const handleAddBlock = () => {
        if (!editor || activeNodePos === null) return;
        const node = editor.state.doc.nodeAt(activeNodePos);
        if (node) {
            editor.chain().focus().insertContentAt(activeNodePos + node.nodeSize, { type: 'paragraph' }).run();
        }
        setShowMenu(false);
    };

    if (!editor) return null;

    return (
        <div ref={wrapperRef} className="relative w-full">
            {/* Handle buttons - positioned on left side */}
            <div
                className={`absolute left-0 flex items-center gap-0.5 -translate-x-full pr-2 transition-opacity duration-100 z-10 ${isVisible ? 'opacity-100' : 'opacity-0'
                    }`}
                style={{ top: handleTop }}
            >
                <button
                    onClick={handleAddBlock}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    title="Add block"
                >
                    <Plus size={14} />
                </button>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-grab"
                    title="Options"
                >
                    <GripVertical size={14} />
                </button>

                {/* Context Menu */}
                {showMenu && (
                    <div
                        ref={menuRef}
                        className="absolute left-0 top-8 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[160px] z-50"
                    >
                        <button onClick={handleDuplicate} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                            <Copy size={14} className="text-gray-400" /> Duplicate
                        </button>
                        <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50">
                            <Trash2 size={14} /> Delete
                        </button>
                        <hr className="my-1" />
                        <button onClick={() => setShowMenu(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                            <ArrowUp size={14} className="text-gray-400" /> Move up
                        </button>
                        <button onClick={() => setShowMenu(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                            <ArrowDown size={14} className="text-gray-400" /> Move down
                        </button>
                    </div>
                )}
            </div>

            {/* Editor content slot */}
            <div className="tiptap-wrapper">
                {/* EditorContent will be rendered here by parent */}
            </div>
        </div>
    );
}

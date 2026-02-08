'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import {
    GripVertical, Plus, Copy, Trash2,
    Table, CheckSquare, Heading1, Heading2,
    Type, Link, ChevronRight
} from 'lucide-react';

interface BlockHandleOverlayProps {
    editor: Editor | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

interface HandlePosition {
    top: number;
    left: number;
    pos: number;
    blockElement: HTMLElement;
}

export default function BlockHandleOverlay({ editor, containerRef }: BlockHandleOverlayProps) {
    const [handlePosition, setHandlePosition] = useState<HandlePosition | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showTurnIntoMenu, setShowTurnIntoMenu] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const handleContainerRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearHideTimeout = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    }, []);

    const scheduleHide = useCallback(() => {
        clearHideTimeout();
        hideTimeoutRef.current = setTimeout(() => {
            if (!isLocked && !showMenu) {
                setHandlePosition(null);
            }
        }, 200);
    }, [clearHideTimeout, isLocked, showMenu]);

    const updateHandlePosition = useCallback((block: HTMLElement, pos: number) => {
        const container = containerRef.current;
        if (!container) return;

        const blockRect = block.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate handle top - account for 72px padding added to container
        // BlockHandleOverlay renders inside editorContentRef, which is already inside padding
        // So we subtract padding to get position relative to editorContentRef
        const CONTAINER_PADDING = 72;

        // No vertical offset needed since paragraph padding is now 0
        const handleTop = blockRect.top - containerRect.top - CONTAINER_PADDING;

        // Handles should appear to the LEFT of content
        // Since we're inside editorContentRef (which is inside padding),
        // use NEGATIVE value to position handles to the left
        const handleLeft = -56;

        setHandlePosition({
            top: handleTop,
            left: handleLeft,
            pos,
            blockElement: block,
        });
        clearHideTimeout();
    }, [containerRef, clearHideTimeout]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!editor || showMenu || isLocked) return;

        const container = containerRef.current;
        if (!container) return;

        const target = event.target as HTMLElement;

        // If mouse is on handle, keep it visible
        if (handleContainerRef.current?.contains(target)) {
            clearHideTimeout();
            return;
        }

        const proseMirror = container.querySelector('.ProseMirror') as HTMLElement;
        if (!proseMirror || !proseMirror.contains(target)) {
            scheduleHide();
            return;
        }

        // Find block element from target
        let block: HTMLElement | null = target;

        // Check for task item or table first
        const taskItem = target.closest('li[data-type="taskItem"]') as HTMLElement;
        const table = target.closest('table') as HTMLElement;

        if (taskItem) {
            block = taskItem;
        } else if (table) {
            block = table;
        } else {
            // Find standard block element
            const blockTags = ['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE'];
            while (block && block !== proseMirror && !blockTags.includes(block.tagName)) {
                block = block.parentElement;
            }
        }

        // Validate block is found and not ProseMirror itself
        if (!block || block === proseMirror) {
            scheduleHide();
            return;
        }

        // Check for actual content
        if (block.textContent && block.textContent.trim().length > 0 && !block.classList.contains('is-editor-empty')) {
            try {
                const pos = editor.view.posAtDOM(block, 0);
                updateHandlePosition(block, pos);
            } catch {
                scheduleHide();
            }
        } else {
            scheduleHide();
        }
    }, [editor, containerRef, showMenu, isLocked, clearHideTimeout, scheduleHide, updateHandlePosition]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener('mousemove', handleMouseMove);
        return () => container.removeEventListener('mousemove', handleMouseMove);
    }, [containerRef, handleMouseMove]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
                setShowTurnIntoMenu(false);
                setIsLocked(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        return () => clearHideTimeout();
    }, [clearHideTimeout]);

    const closeMenu = () => {
        setShowMenu(false);
        setShowTurnIntoMenu(false);
        setIsLocked(false);
    };

    // Actions
    const handleAddBlock = () => {
        if (!editor || !handlePosition) return;
        const node = editor.state.doc.nodeAt(handlePosition.pos);
        if (node) {
            editor.chain().focus().insertContentAt(handlePosition.pos + node.nodeSize, { type: 'paragraph' }).run();
        }
    };

    const handleDuplicate = () => {
        if (!editor || !handlePosition) return;
        const node = editor.state.doc.nodeAt(handlePosition.pos);
        if (node) {
            editor.chain().focus().insertContentAt(handlePosition.pos + node.nodeSize, node.toJSON()).run();
        }
        closeMenu();
    };

    const handleDelete = () => {
        if (!editor || !handlePosition) return;
        const node = editor.state.doc.nodeAt(handlePosition.pos);
        if (node) {
            editor.chain().focus().deleteRange({ from: handlePosition.pos, to: handlePosition.pos + node.nodeSize }).run();
        }
        closeMenu();
        setHandlePosition(null);
    };

    // Turn Into actions
    const turnIntoHeading1 = () => {
        if (!editor || !handlePosition) return;
        editor.chain().focus().setTextSelection(handlePosition.pos).setNode('heading', { level: 1 }).run();
        closeMenu();
    };

    const turnIntoHeading2 = () => {
        if (!editor || !handlePosition) return;
        editor.chain().focus().setTextSelection(handlePosition.pos).setNode('heading', { level: 2 }).run();
        closeMenu();
    };

    const turnIntoParagraph = () => {
        if (!editor || !handlePosition) return;
        editor.chain().focus().setTextSelection(handlePosition.pos).setParagraph().run();
        closeMenu();
    };

    const turnIntoChecklist = () => {
        if (!editor || !handlePosition) return;
        editor.chain().focus().setTextSelection(handlePosition.pos).toggleTaskList().run();
        closeMenu();
    };

    const insertTable = () => {
        if (!editor || !handlePosition) return;
        const node = editor.state.doc.nodeAt(handlePosition.pos);
        if (node) {
            editor.chain().focus().insertContentAt(handlePosition.pos + node.nodeSize, { type: 'paragraph' }).run();
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }
        closeMenu();
    };

    const addLink = () => {
        if (!editor) return;
        const url = window.prompt('Enter URL:');
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
        closeMenu();
    };

    if (!editor || !handlePosition) return null;

    return (
        <>
            {/* Block Handle */}
            <div
                ref={handleContainerRef}
                className="absolute flex items-center gap-0.5 z-20"
                style={{
                    top: handlePosition.top,
                    left: handlePosition.left,
                }}
                onMouseEnter={() => {
                    clearHideTimeout();
                    setIsLocked(true);
                }}
                onMouseLeave={() => {
                    setIsLocked(false);
                    if (!showMenu) {
                        scheduleHide();
                    }
                }}
            >
                <button
                    onClick={handleAddBlock}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Add block"
                >
                    <Plus size={14} />
                </button>
                <button
                    onClick={() => {
                        setShowMenu(!showMenu);
                        setShowTurnIntoMenu(false);
                        setIsLocked(true);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-grab transition-colors"
                    title="Menu"
                >
                    <GripVertical size={14} />
                </button>
            </div>

            {/* Context Menu */}
            {showMenu && (
                <div
                    ref={menuRef}
                    className="absolute bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[200px] py-1"
                    style={{
                        top: handlePosition.top + 28,
                        left: handlePosition.left,
                    }}
                >
                    {/* Turn into submenu */}
                    <div
                        className="relative"
                        onMouseEnter={() => setShowTurnIntoMenu(true)}
                        onMouseLeave={() => setShowTurnIntoMenu(false)}
                    >
                        <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <span className="flex items-center gap-2">
                                <Type size={14} className="text-gray-400" />
                                Turn into
                            </span>
                            <ChevronRight size={14} className="text-gray-400" />
                        </button>

                        {/* Turn into submenu */}
                        {showTurnIntoMenu && (
                            <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] py-1">
                                <button onClick={turnIntoParagraph} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Type size={14} className="text-gray-400" />
                                    Text
                                </button>
                                <button onClick={turnIntoHeading1} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Heading1 size={14} className="text-gray-400" />
                                    Heading 1
                                </button>
                                <button onClick={turnIntoHeading2} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Heading2 size={14} className="text-gray-400" />
                                    Heading 2
                                </button>
                                <button onClick={turnIntoChecklist} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <CheckSquare size={14} className="text-gray-400" />
                                    To-do list
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 my-1" />

                    {/* Insert Table */}
                    <button onClick={insertTable} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Table size={14} className="text-gray-400" />
                        Insert table
                    </button>

                    {/* Add Link */}
                    <button onClick={addLink} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Link size={14} className="text-gray-400" />
                        Add link
                    </button>

                    <div className="border-t border-gray-100 my-1" />

                    {/* Duplicate */}
                    <button onClick={handleDuplicate} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Copy size={14} className="text-gray-400" />
                        Duplicate
                    </button>

                    {/* Delete */}
                    <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50">
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            )}
        </>
    );
}

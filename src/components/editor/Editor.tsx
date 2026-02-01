'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Mention from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { PasteFirewall } from './extensions/PasteFirewall';
import { MarkdownPasteHandler } from './extensions/MarkdownPasteHandler';
import { mentionSuggestion } from './extensions/MentionSuggestion';
import { SlashCommands } from './extensions/SlashCommands';
import { QualityScanner } from './extensions/QualityScanner';
import SlashCommandsMenu, { getSuggestionItems } from './SlashCommandsMenu';
import FloatingToolbar from './FloatingToolbar';
import BlockHandleOverlay from './BlockHandleOverlay';
import { Edit3, Link2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useStyleStore } from '@/store/styleStore';
import { DocumentHeader } from './DocumentHeaderFooter';
import RequirementLinkPopup from './RequirementLinkPopup';
import { PageBreakExtension, PAGE_HEIGHT, PAGE_GAP } from './extensions/PageBreakExtension';
// DocBrand Path E Architecture imports
import { EditorController, RequirementLinking, BlockIndex, DocBlock, DocBlockWrapper, NodeSelectionExtension, LinkedBlockDecorator, markBlockAsLinked } from '@/lib/editor';

interface EditorProps {
    onEditHeaderFooter?: () => void;
}

export default function Editor({ onEditHeaderFooter }: EditorProps) {
    const setEditor = useEditorStore((state) => state.setEditor);
    const setStorePageCount = useEditorStore((state) => state.setPageCount);
    const { requirements, activeLinkingReqId, linkToBlock, setLinkingMode } = useRequirementsStore();

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

    // Get style values from store
    const { fontFamily, fontSize, lineHeight, spaceBefore, spaceAfter, firstLineIndent } = useStyleStore();

    // Ref for dynamic style element
    const styleRef = useRef<HTMLStyleElement | null>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorContentRef = useRef<HTMLDivElement>(null);

    // Page count from PageBreakExtension (for minHeight calculation)
    const [pageCount, setPageCount] = useState(1);

    // Listen for page count updates from extension
    useEffect(() => {
        const handlePageBreaksUpdate = (e: CustomEvent) => {
            const newPageCount = e.detail.pageCount;
            setPageCount(newPageCount);
            setStorePageCount(newPageCount); // Update store for StatusBar
        };
        document.addEventListener('pagebreaks-updated', handlePageBreaksUpdate as EventListener);
        return () => {
            document.removeEventListener('pagebreaks-updated', handlePageBreaksUpdate as EventListener);
        };
    }, [setStorePageCount]);

    // Count unlinked requirements
    const hasUnlinkedReqs = requirements.some(r => r.status === 'unlinked');

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
            }),
            Heading.configure({
                levels: [1, 2],
            }),
            Placeholder.configure({
                placeholder: 'Start writing your proposal...',
            }),
            TextStyle,
            FontFamily,
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 underline',
                },
            }),
            Dropcursor.configure({
                color: '#388bfd',
                width: 2,
            }),
            Gapcursor,
            SlashCommands.configure({
                suggestion: {
                    items: getSuggestionItems,
                    render: () => {
                        let component: ReactRenderer | null = null;
                        let popup: TippyInstance[] | null = null;

                        return {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onStart: (props: any) => {
                                component = new ReactRenderer(SlashCommandsMenu, {
                                    props,
                                    editor: props.editor,
                                });

                                popup = tippy('body', {
                                    getReferenceClientRect: props.clientRect,
                                    appendTo: () => document.body,
                                    content: component.element,
                                    showOnCreate: true,
                                    interactive: true,
                                    trigger: 'manual',
                                    placement: 'bottom-start',
                                });
                            },
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onUpdate: (props: any) => {
                                component?.updateProps(props);

                                if (popup?.[0]) {
                                    popup[0].setProps({
                                        getReferenceClientRect: props.clientRect,
                                    });
                                }
                            },
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onKeyDown: (props: any) => {
                                if (props.event.key === 'Escape') {
                                    popup?.[0]?.hide();
                                    return true;
                                }

                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                return (component?.ref as any)?.onKeyDown?.(props.event) ?? false;
                            },
                            onExit: () => {
                                popup?.[0]?.destroy();
                                component?.destroy();
                            },
                        };
                    },
                },
            }),
            PasteFirewall,
            MarkdownPasteHandler, // Auto-format markdown on paste
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion: mentionSuggestion,
            }),
            QualityScanner, // Quality issue highlighting
            // DocBrand Path E Architecture
            DocBlock, // Block wrapper with linkedRequirements
            DocBlockWrapper, // Auto-wrap raw blocks
            RequirementLinking,
            BlockIndex,
            NodeSelectionExtension, // Alt+Click/Alt+A block selection
            LinkedBlockDecorator, // Persistent visual indicators for linked blocks
            PageBreakExtension, // Auto page breaks
        ],
        immediatelyRender: false,
        content: '', // Empty by default
        editorProps: {
            attributes: {
                class: 'prose prose-slate max-w-none focus:outline-none min-h-[800px]',
            },
        },
    });

    // Sync editor with global store and EditorController
    useEffect(() => {
        if (editor) {
            setEditor(editor);
            EditorController.setEditor(editor);
        }
        return () => {
            setEditor(null);
            EditorController.clearEditor();
        };
    }, [editor, setEditor]);

    // Inject dynamic styles via <style> tag
    useEffect(() => {
        if (!styleRef.current) {
            styleRef.current = document.createElement('style');
            styleRef.current.id = 'dynamic-editor-styles';
            document.head.appendChild(styleRef.current);
        }

        // Generate CSS rules including red line indicator
        const css = `
            .ProseMirror {
                font-family: '${fontFamily}', sans-serif !important;
                font-size: ${fontSize}px !important;
                line-height: ${lineHeight} !important;
                position: relative;
            }
            .ProseMirror p {
                font-family: '${fontFamily}', sans-serif !important;
                font-size: ${fontSize}px !important;
                line-height: ${lineHeight} !important;
                margin-top: ${spaceBefore}pt !important;
                margin-bottom: ${spaceAfter}pt !important;
                text-indent: ${firstLineIndent}in !important;
                position: relative;
            }
            .ProseMirror h1 {
                font-family: '${fontFamily}', sans-serif !important;
                font-size: ${Math.round(fontSize * 2.3)}px !important;
                line-height: 1.2 !important;
                margin-top: ${spaceBefore}pt !important;
                margin-bottom: ${spaceAfter}pt !important;
            }
            .ProseMirror h2 {
                font-family: '${fontFamily}', sans-serif !important;
                font-size: ${Math.round(fontSize * 1.7)}px !important;
                line-height: 1.3 !important;
                margin-top: ${spaceBefore}pt !important;
                margin-bottom: ${spaceAfter}pt !important;
            }
        `;

        styleRef.current.textContent = css;

        return () => {
            if (styleRef.current && styleRef.current.parentNode) {
                styleRef.current.parentNode.removeChild(styleRef.current);
                styleRef.current = null;
            }
        };
    }, [fontFamily, fontSize, lineHeight, spaceBefore, spaceAfter, firstLineIndent]);

    // Handle click to link requirement to block
    const handleEditorClick = useCallback(() => {
        if (!activeLinkingReqId || !editor) return;

        const { from } = editor.state.selection;
        const $from = editor.state.doc.resolve(from);

        // Find the nearest block-level element using ProseMirror view
        let blockElement: HTMLElement | null = null;
        try {
            const domPos = editor.view.domAtPos(from);
            // Get the DOM node and traverse up to find block element
            let node: Node | null = domPos.node;
            if (domPos.offset && node.childNodes[domPos.offset]) {
                node = node.childNodes[domPos.offset];
            }
            // Find closest block element
            if (node) {
                const el = node instanceof HTMLElement ? node : node.parentElement;
                blockElement = el?.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote') as HTMLElement;
                // Fallback: search within editor
                if (!blockElement) {
                    const editorEl = editor.view.dom;
                    const allBlocks = editorEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
                    // Find block containing selection
                    const sel = window.getSelection();
                    if (sel && sel.anchorNode) {
                        blockElement = (sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('p, h1, h2, h3, h4, h5, h6') as HTMLElement;
                    }
                }
            }
        } catch (e) {
            console.warn('[Editor] Error finding block element:', e);
        }

        // Get current block ID from EditorController
        let blockId = EditorController.getCurrentBlockId();

        if (!blockId) {
            // Create a stable block ID based on content hash + position
            const blockNode = $from.parent;
            const textContent = blockNode.textContent.substring(0, 50);
            const hash = textContent.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            blockId = `block-${Math.abs(hash).toString(16).substring(0, 8)}`;
        }

        // Mark the DOM element with the block ID for later navigation
        if (blockElement && !blockElement.hasAttribute('data-block-id')) {
            blockElement.setAttribute('data-block-id', blockId);
        }

        // Mark block as linked for green border styling (DOM fallback)
        if (blockElement) {
            blockElement.setAttribute('data-linked', 'true');
            // Add CSS class for styling
            blockElement.classList.add('block-linked');
            // Add inline style as fallback for immediate feedback
            blockElement.style.borderLeft = '4px solid #3fb950';
            blockElement.style.paddingLeft = '12px';
            blockElement.style.marginLeft = '-16px';
            console.log('[Editor] Block linked:', blockId, blockElement);
        } else {
            console.warn('[Editor] Block element not found for linking');
        }

        // Register with decoration plugin for persistent visual feedback
        markBlockAsLinked(blockId);

        // Force editor refresh to update decorations
        editor.view.dispatch(editor.state.tr);

        // Try Path E linking first
        if (EditorController.isReady()) {
            EditorController.linkRequirementToBlock(blockId, activeLinkingReqId);
        }

        // Also save to Zustand store
        linkToBlock(activeLinkingReqId, blockId);
        setLinkingMode(null);
    }, [activeLinkingReqId, editor, linkToBlock, setLinkingMode]);

    // Handle red line click
    const handleRedLineClick = useCallback((e: React.MouseEvent, blockId: string) => {
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setPopupPosition({ x: rect.left + 20, y: rect.top });
        setActiveBlockId(blockId);
        setShowPopup(true);
    }, []);

    const isLinkingMode = !!activeLinkingReqId;

    return (
        <div className="flex-1 flex flex-col items-center py-8 px-4 overflow-y-auto bg-[#0d1117]">
            {/* Linking Mode Banner */}
            {isLinkingMode && (
                <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-[#388bfd22] border border-[#388bfd] rounded-lg animate-pulse">
                    <Link2 size={14} className="text-[#388bfd]" />
                    <span className="text-sm text-[#388bfd]">Click a paragraph to link requirement</span>
                    <button
                        onClick={() => setLinkingMode(null)}
                        className="ml-2 text-xs text-[#8b949e] hover:text-white"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Edit Header & Footer button */}
            {!isLinkingMode && (
                <button
                    onClick={onEditHeaderFooter}
                    className="mb-4 flex items-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] rounded-lg text-xs text-[#8b949e] transition-colors"
                >
                    <Edit3 size={12} />
                    Edit Header & Footer
                </button>
            )}

            {/* Word-style Multi-Page Document */}
            <div className="w-full max-w-[800px] relative">
                {/* Single white container */}
                <div
                    ref={editorContainerRef}
                    onClick={handleEditorClick}
                    className={`w-full bg-white rounded-lg shadow-2xl document-editor transition-all relative ${isLinkingMode ? 'ring-2 ring-[#388bfd] cursor-crosshair' : ''}`}
                    style={{
                        minHeight: `${PAGE_HEIGHT}px`,
                    }}
                >
                    {/* Red Line Indicator for unlinked requirements */}
                    {hasUnlinkedReqs && !isLinkingMode && (
                        <div
                            onClick={(e) => handleRedLineClick(e, 'block-main')}
                            className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#f85149] cursor-pointer hover:w-2 transition-all rounded-l-lg z-30"
                            title="Click to link requirements"
                        >
                            <div className="absolute top-1/2 -translate-y-1/2 left-3 w-5 h-5 bg-[#f85149] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                {requirements.filter(r => r.status === 'unlinked').length}
                            </div>
                        </div>
                    )}

                    {/* Floating Toolbar */}
                    <FloatingToolbar editor={editor} />

                    {/* Document Header */}
                    <DocumentHeader />

                    {/* Editor Content */}
                    <div
                        ref={editorContentRef}
                        className="px-16 py-8 relative"
                    >
                        <BlockHandleOverlay editor={editor} containerRef={editorContainerRef} />
                        <EditorContent editor={editor} />
                    </div>
                </div>

                {/* Page gap overlays - visual only */}
                {pageCount > 1 && Array.from({ length: pageCount - 1 }, (_, i) => (
                    <div
                        key={`page-gap-${i}`}
                        className="absolute left-0 right-0 bg-[#0d1117] pointer-events-none z-40"
                        style={{
                            top: `${(i + 1) * PAGE_HEIGHT}px`,
                            height: `${PAGE_GAP}px`,
                        }}
                    />
                ))}
            </div>

            {/* Requirement Link Popup */}
            {showPopup && activeBlockId && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowPopup(false)}
                    />
                    <RequirementLinkPopup
                        blockId={activeBlockId}
                        position={popupPosition}
                        onClose={() => setShowPopup(false)}
                    />
                </>
            )}
        </div>
    );
}

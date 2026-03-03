'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { CustomTableCell } from './extensions/CustomTableCell';
import { TableHeader } from '@tiptap/extension-table-header';
import Mention from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import DocStyle from '@/extensions/DocStyle';
import CalloutBox from '@/extensions/CalloutBox';
import { PasteFirewall } from './extensions/PasteFirewall';
import { MarkdownPasteHandler } from './extensions/MarkdownPasteHandler';
import { mentionSuggestion } from './extensions/MentionSuggestion';
import { SlashCommands } from './extensions/SlashCommands';
import { QualityScanner } from './extensions/QualityScanner';
import { FontSize } from './extensions/FontSize';
import { TableTabHandler } from './extensions/TableTabHandler';
import { LineHeight } from './extensions/LineHeight';
import SlashCommandsMenu, { getSuggestionItems } from './SlashCommandsMenu';
import FloatingToolbar from './FloatingToolbar';
import TableBubbleMenu from './TableBubbleMenu';
import BlockHandleOverlay from './BlockHandleOverlay';
import { Edit3, Link2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useStyleStore } from '@/store/styleStore';
import { useUIStore } from '@/store/uiStore';
import { DocumentHeader, DocumentFooter } from './DocumentHeaderFooter';
import MarginGuide from './MarginGuide';
// Removed PageBreakExtension - using infinite scroll instead
// DocBrand Path E Architecture imports
import { EditorController, RequirementLinking, BlockIndex, DocBlock, DocBlockWrapper, NodeSelectionExtension, LinkedBlockDecorator, markBlockAsLinked } from '@/lib/editor';

interface EditorProps {
    onEditHeaderFooter?: () => void;
}

export default function Editor({ onEditHeaderFooter }: EditorProps) {
    const setEditor = useEditorStore((state) => state.setEditor);
    // Removed pageCount - no longer using pagination
    const { requirements, activeLinkingReqId, linkToBlock, setLinkingMode } = useRequirementsStore();

    // Get style values from store
    const {
        fontFamily, fontSize, lineHeight, spaceBefore, spaceAfter, firstLineIndent, bodyColor,
        h1Color, h1FontSize, h1SpaceBefore, h1SpaceAfter, h1LineHeight,
        h2Color, h2FontSize, h2SpaceBefore, h2SpaceAfter, h2LineHeight,
        h3Color, h3FontSize, h3SpaceBefore, h3SpaceAfter, h3LineHeight,
        h4Color, h4FontSize, h4SpaceBefore, h4SpaceAfter, h4LineHeight,
        h5Color, h5FontSize, h5SpaceBefore, h5SpaceAfter, h5LineHeight,
        h6Color, h6FontSize, h6SpaceBefore, h6SpaceAfter, h6LineHeight,
        titleFontSize, titleColor, titleLineHeight, titleSpaceBefore, titleSpaceAfter,
        subtitleFontSize, subtitleColor, subtitleLineHeight, subtitleSpaceBefore, subtitleSpaceAfter,
        marginTop, marginBottom, marginLeft, marginRight,
    } = useStyleStore();

    // Auto-heading toast
    const autoHeadingToast = useUIStore((state) => state.autoHeadingToast);
    const hideAutoHeadingToast = useUIStore((state) => state.hideAutoHeadingToast);

    // Paste toast
    const pasteToast = useUIStore((state) => state.pasteToast);
    const hidePasteToast = useUIStore((state) => state.hidePasteToast);

    // Ref for dynamic style element
    const styleRef = useRef<HTMLStyleElement | null>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorContentRef = useRef<HTMLDivElement>(null);

    // Removed pageCount state and listener - no pagination needed

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
            }),
            Heading.configure({
                levels: [1, 2, 3, 4, 5, 6],
            }),
            Placeholder.configure({
                placeholder: 'Start writing your proposal...',
            }),
            TextStyle,
            Color,
            FontFamily,
            FontSize,
            LineHeight,
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
            CustomTableCell,
            TableTabHandler,
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion: mentionSuggestion,
            }),
            DocStyle, // Title/Subtitle doc-style marks
            CalloutBox, // Callout box wrapper
            QualityScanner, // Quality issue highlighting
            // DocBrand Path E Architecture
            DocBlock, // Block wrapper with linkedRequirements
            DocBlockWrapper, // Auto-wrap raw blocks
            RequirementLinking,
            BlockIndex,
            NodeSelectionExtension, // Alt+Click/Alt+A block selection
            LinkedBlockDecorator, // Persistent visual indicators for linked blocks
            // Removed PageBreakExtension - infinite scroll instead
        ],
        immediatelyRender: false,
        content: '', // Empty by default
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none min-h-[800px]',
                style: 'white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;',
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

        const css = `
            .ProseMirror {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${fontSize}pt !important;
                line-height: ${lineHeight} !important;
                color: ${bodyColor} !important;
                position: relative;
                white-space: pre-wrap;
                overflow-wrap: break-word;
                word-break: break-word;
                max-width: 100%;
            }
            .ProseMirror p {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${fontSize}pt !important;
                line-height: ${lineHeight} !important;
                color: ${bodyColor} !important;
                margin-top: ${spaceBefore}pt !important;
                margin-bottom: ${spaceAfter}pt !important;
                text-indent: ${firstLineIndent}in !important;
                position: relative;
            }
            .ProseMirror h1 {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${h1FontSize}pt !important;
                font-weight: bold !important;
                line-height: ${h1LineHeight} !important;
                color: ${h1Color} !important;
                margin-top: ${h1SpaceBefore}pt !important;
                margin-bottom: ${h1SpaceAfter}pt !important;
            }
            .ProseMirror h2 {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${h2FontSize}pt !important;
                font-weight: bold !important;
                line-height: ${h2LineHeight} !important;
                color: ${h2Color} !important;
                margin-top: ${h2SpaceBefore}pt !important;
                margin-bottom: ${h2SpaceAfter}pt !important;
            }
            .ProseMirror h3 {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${h3FontSize}pt !important;
                font-weight: bold !important;
                font-style: italic !important;
                line-height: ${h3LineHeight} !important;
                color: ${h3Color} !important;
                margin-top: ${h3SpaceBefore}pt !important;
                margin-bottom: ${h3SpaceAfter}pt !important;
            }
            .ProseMirror h4 {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${h4FontSize}pt !important;
                font-weight: normal !important;
                line-height: ${h4LineHeight} !important;
                color: ${h4Color} !important;
                margin-top: ${h4SpaceBefore}pt !important;
                margin-bottom: ${h4SpaceAfter}pt !important;
            }
            .ProseMirror h5 {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${h5FontSize}pt !important;
                font-weight: normal !important;
                line-height: ${h5LineHeight} !important;
                color: ${h5Color} !important;
                margin-top: ${h5SpaceBefore}pt !important;
                margin-bottom: ${h5SpaceAfter}pt !important;
            }
            .ProseMirror h6 {
                font-family: '${fontFamily}', Times, serif;
                font-size: ${h6FontSize}pt !important;
                font-weight: normal !important;
                font-style: italic !important;
                line-height: ${h6LineHeight} !important;
                color: ${h6Color} !important;
                margin-top: ${h6SpaceBefore}pt !important;
                margin-bottom: ${h6SpaceAfter}pt !important;
            }
            .ProseMirror p[data-doc-style="title"] {
                font-size: ${titleFontSize}pt !important;
                font-weight: bold !important;
                line-height: 1.2 !important;
                color: ${titleColor} !important;
                margin-top: ${titleSpaceBefore}pt !important;
                margin-bottom: ${titleSpaceAfter}pt !important;
                text-indent: 0 !important;
            }
            .ProseMirror p[data-doc-style="subtitle"] {
                font-size: ${subtitleFontSize}pt !important;
                font-style: italic !important;
                font-weight: normal !important;
                line-height: ${subtitleLineHeight} !important;
                color: ${subtitleColor} !important;
                margin-top: ${subtitleSpaceBefore}pt !important;
                margin-bottom: ${subtitleSpaceAfter}pt !important;
                text-indent: 0 !important;
            }
        `;

        styleRef.current.textContent = css;

        return () => {
            if (styleRef.current && styleRef.current.parentNode) {
                styleRef.current.parentNode.removeChild(styleRef.current);
                styleRef.current = null;
            }
        };
    }, [fontFamily, fontSize, lineHeight, spaceBefore, spaceAfter, firstLineIndent, bodyColor,
        h1FontSize, h1Color, h1SpaceBefore, h1SpaceAfter, h1LineHeight,
        h2FontSize, h2Color, h2SpaceBefore, h2SpaceAfter, h2LineHeight,
        h3FontSize, h3Color, h3SpaceBefore, h3SpaceAfter, h3LineHeight,
        h4FontSize, h4Color, h4SpaceBefore, h4SpaceAfter, h4LineHeight,
        h5FontSize, h5Color, h5SpaceBefore, h5SpaceAfter, h5LineHeight,
        h6FontSize, h6Color, h6SpaceBefore, h6SpaceAfter, h6LineHeight,
        titleFontSize, titleColor, titleLineHeight, titleSpaceBefore, titleSpaceAfter,
        subtitleFontSize, subtitleColor, subtitleLineHeight, subtitleSpaceBefore, subtitleSpaceAfter]);

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
            blockElement.style.marginLeft = '0';
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

    // Auto-heading toast: auto-dismiss after 5 seconds
    useEffect(() => {
        if (!autoHeadingToast) return;
        const timer = setTimeout(() => hideAutoHeadingToast(), 5000);
        return () => clearTimeout(timer);
    }, [autoHeadingToast, hideAutoHeadingToast]);

    const handleAutoHeadingUndo = useCallback(() => {
        if (editor) editor.commands.undo();
        hideAutoHeadingToast();
    }, [editor, hideAutoHeadingToast]);

    // Paste toast: auto-dismiss
    useEffect(() => {
        if (!pasteToast) return;
        const duration = pasteToast.changesCount ? 5000 : 3000;
        const timer = setTimeout(() => hidePasteToast(), duration);
        return () => clearTimeout(timer);
    }, [pasteToast, hidePasteToast]);

    // Drag & drop requirement linking
    const [isDragOver, setIsDragOver] = useState(false);

    const handleRequirementDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const reqId = e.dataTransfer.getData('application/x-requirement-id');
        if (!reqId || !editor) return;

        // Find block element at drop position
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (!target) return;

        const blockEl = target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote') as HTMLElement;
        if (!blockEl) return;

        // Generate block ID (same logic as handleEditorClick)
        let blockId = blockEl.getAttribute('data-block-id');
        if (!blockId) {
            const textContent = (blockEl.textContent || '').substring(0, 50);
            const hash = textContent.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            blockId = `block-${Math.abs(hash).toString(16).substring(0, 8)}`;
        }

        // Set DOM attributes
        blockEl.setAttribute('data-block-id', blockId);
        blockEl.setAttribute('data-linked', 'true');
        blockEl.classList.add('block-linked');
        blockEl.style.borderLeft = '4px solid #3fb950';
        blockEl.style.paddingLeft = '12px';
        blockEl.style.marginLeft = '0';

        // Register with decoration plugin
        markBlockAsLinked(blockId);
        editor.view.dispatch(editor.state.tr);

        // Dual link: Path E + Zustand
        if (EditorController.isReady()) {
            EditorController.linkRequirementToBlock(blockId, reqId);
        }
        linkToBlock(reqId, blockId);

        // Visual feedback
        useUIStore.getState().showPasteToast('Requirement linked!');
    }, [editor, linkToBlock]);

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

            {/* Auto-Heading Toast */}
            {autoHeadingToast && (
                <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-[#3fb95022] border border-[#3fb950] rounded-lg">
                    <span className="text-sm text-[#3fb950]">
                        Converted {autoHeadingToast.count} line{autoHeadingToast.count !== 1 ? 's' : ''} to Headings
                    </span>
                    <span className="text-[#484f58]">—</span>
                    <button
                        onClick={handleAutoHeadingUndo}
                        className="text-sm text-[#388bfd] hover:text-[#58a6ff] underline"
                    >
                        Undo
                    </button>
                    <button
                        onClick={hideAutoHeadingToast}
                        className="ml-auto text-xs text-[#8b949e] hover:text-white"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Paste Toast */}
            {pasteToast && (
                <div
                    className="paste-toast-container"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#1F2937',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        animation: 'pasteToastIn 0.2s ease-out',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                        <rect x="1" y="1" width="16" height="16" rx="3" fill="none" stroke="#22C55E" strokeWidth="2" />
                        <path
                            d="M4 9 L7.5 12.5 L14 6"
                            fill="none"
                            stroke="#22C55E"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                strokeDasharray: 20,
                                strokeDashoffset: 0,
                                animation: 'checkmarkDraw 0.3s ease-out 0.1s both',
                            }}
                        />
                    </svg>
                    <span>
                        {pasteToast.changesCount && pasteToast.changesCount > 0
                            ? `Content pasted — ${pasteToast.changesCount} formatting changes cleaned`
                            : 'Content pasted'
                        }
                    </span>
                    {pasteToast.changesCount && pasteToast.changesCount > 0 && (
                        <button
                            onClick={hidePasteToast}
                            style={{
                                marginLeft: '8px',
                                background: 'none',
                                border: 'none',
                                color: '#9CA3AF',
                                cursor: 'pointer',
                                fontSize: '12px',
                            }}
                        >
                            ✕
                        </button>
                    )}
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

            {/* Infinite Scroll Document */}
            <div className="w-full max-w-[800px] relative">
                {/* Single white container that grows with content */}
                <div
                    ref={editorContainerRef}
                    onClick={handleEditorClick}
                    onDragOver={(e) => {
                        if (e.dataTransfer.types.includes('application/x-requirement-id')) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'link';
                            setIsDragOver(true);
                        }
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleRequirementDrop}
                    className={`w-full bg-white rounded-lg shadow-2xl document-editor transition-all relative ${isLinkingMode ? 'ring-2 ring-[#388bfd] cursor-crosshair' : ''}`}
                    style={{
                        minHeight: '800px',
                        paddingTop: `${marginTop}px`,
                        paddingBottom: `${marginBottom}px`,
                        paddingLeft: `${marginLeft}px`,
                        paddingRight: `${marginRight}px`,
                        outline: isDragOver ? '2px dashed #388bfd' : 'none',
                        outlineOffset: '-2px',
                    }}
                >
                    {/* Margin Guide overlay */}
                    <MarginGuide />

                    {/* Floating Toolbar */}
                    <FloatingToolbar editor={editor} />

                    {/* Table Bubble Menu */}
                    {editor && <TableBubbleMenu editor={editor} />}

                    {/* Document Header */}
                    <DocumentHeader />

                    {/* Editor Content with proper text wrapping */}
                    <div
                        ref={editorContentRef}
                        className="relative"
                        style={{
                            maxWidth: '100%',
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                        }}
                    >
                        <BlockHandleOverlay editor={editor} containerRef={editorContentRef} />
                        <EditorContent editor={editor} />
                    </div>

                    {/* Document Footer */}
                    <DocumentFooter />
                </div>
            </div>

        </div>
    );
}

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { PasteFirewall } from './extensions/PasteFirewall';
import FloatingToolbar from './FloatingToolbar';
import { Edit3, Link2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useStyleStore } from '@/store/styleStore';
import RequirementLinkPopup from './RequirementLinkPopup';

interface EditorProps {
    onEditHeaderFooter?: () => void;
}

export default function Editor({ onEditHeaderFooter }: EditorProps) {
    const setEditor = useEditorStore((state) => state.setEditor);
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
            PasteFirewall,
        ],
        immediatelyRender: false,
        content: '', // Empty by default
        editorProps: {
            attributes: {
                class: 'prose prose-slate max-w-none focus:outline-none min-h-[800px]',
            },
        },
    });

    // Sync editor with global store
    useEffect(() => {
        if (editor) {
            setEditor(editor);
        }
        return () => setEditor(null);
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
        const blockId = `block-${from}`;
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

            {/* Document with red line indicator */}
            <div
                ref={editorContainerRef}
                onClick={handleEditorClick}
                className={`w-full max-w-[800px] bg-white rounded-lg shadow-2xl min-h-[1000px] document-editor transition-all relative ${isLinkingMode ? 'ring-2 ring-[#388bfd] cursor-crosshair' : ''}`}
            >
                {/* Red Line Indicator for unlinked requirements */}
                {hasUnlinkedReqs && !isLinkingMode && (
                    <div
                        onClick={(e) => handleRedLineClick(e, 'block-main')}
                        className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#f85149] cursor-pointer hover:w-2 transition-all rounded-l-lg"
                        title="Click to link requirements"
                    >
                        <div className="absolute top-1/2 -translate-y-1/2 left-3 w-5 h-5 bg-[#f85149] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                            {requirements.filter(r => r.status === 'unlinked').length}
                        </div>
                    </div>
                )}

                {/* Floating Toolbar for text selection */}
                <FloatingToolbar editor={editor} />

                <EditorContent editor={editor} />
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

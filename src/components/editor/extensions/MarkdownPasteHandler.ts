/**
 * Markdown Paste Handler Extension for TipTap
 * 
 * Detects markdown syntax in pasted plain text and converts
 * to formatted TipTap content with proper styles.
 * 
 * Supports:
 * - # Heading 1, ## Heading 2, ### Heading 3
 * - **bold**, *italic*, ***bold italic***
 * - - bullet list, 1. ordered list
 * - --- horizontal rule
 * 
 * @see implementation_plan.md
 * 
 * NOTE: This is a NEW file - does not modify any existing code
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// =============================================================================
// TYPES
// =============================================================================

interface ParsedBlock {
    type: 'heading' | 'paragraph' | 'bulletList' | 'orderedList' | 'horizontalRule';
    level?: number;
    content: string;
    marks?: Array<{ type: 'bold' | 'italic' }>;
}

interface MarkdownPasteState {
    lastPasteWasMarkdown: boolean;
    blockCount: number;
}

// =============================================================================
// PLUGIN KEY
// =============================================================================

export const markdownPasteKey = new PluginKey<MarkdownPasteState>('markdownPasteHandler');

// =============================================================================
// MARKDOWN PARSER
// =============================================================================

/**
 * Check if text contains markdown syntax
 */
function containsMarkdownSyntax(text: string): boolean {
    const markdownPatterns = [
        /^#{1,6}\s+/m,           // Headings
        /\*\*[^*]+\*\*/,         // Bold
        /\*[^*]+\*/,             // Italic
        /^[-*+]\s+/m,            // Bullet list
        /^\d+\.\s+/m,            // Ordered list
        /^---$/m,                // Horizontal rule
        /^>\s+/m,                // Blockquote
        /`[^`]+`/,               // Inline code
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Parse inline markdown marks (bold, italic)
 */
function parseInlineMarks(text: string): { cleanText: string; hasBold: boolean; hasItalic: boolean } {
    let cleanText = text;
    let hasBold = false;
    let hasItalic = false;

    // Check for bold (**text** or __text__)
    if (/\*\*[^*]+\*\*/.test(cleanText) || /__[^_]+__/.test(cleanText)) {
        hasBold = true;
        cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, '$1');
        cleanText = cleanText.replace(/__([^_]+)__/g, '$1');
    }

    // Check for italic (*text* or _text_)
    if (/\*[^*]+\*/.test(cleanText) || /_[^_]+_/.test(cleanText)) {
        hasItalic = true;
        cleanText = cleanText.replace(/\*([^*]+)\*/g, '$1');
        cleanText = cleanText.replace(/_([^_]+)_/g, '$1');
    }

    return { cleanText, hasBold, hasItalic };
}

/**
 * Parse markdown text into blocks
 */
function parseMarkdownToBlocks(text: string): ParsedBlock[] {
    const lines = text.split('\n');
    const blocks: ParsedBlock[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) continue;

        // Horizontal rule
        if (/^---$/.test(line) || /^\*\*\*$/.test(line) || /^___$/.test(line)) {
            blocks.push({ type: 'horizontalRule', content: '' });
            continue;
        }

        // Headings (# to ######)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const { cleanText } = parseInlineMarks(headingMatch[2]);
            blocks.push({
                type: 'heading',
                level: Math.min(level, 3), // TipTap typically uses h1-h3
                content: cleanText,
            });
            continue;
        }

        // Bullet list
        const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
        if (bulletMatch) {
            const { cleanText, hasBold, hasItalic } = parseInlineMarks(bulletMatch[1]);
            const marks: Array<{ type: 'bold' | 'italic' }> = [];
            if (hasBold) marks.push({ type: 'bold' });
            if (hasItalic) marks.push({ type: 'italic' });
            blocks.push({
                type: 'bulletList',
                content: cleanText,
                marks: marks.length > 0 ? marks : undefined,
            });
            continue;
        }

        // Ordered list
        const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
        if (orderedMatch) {
            const { cleanText, hasBold, hasItalic } = parseInlineMarks(orderedMatch[1]);
            const marks: Array<{ type: 'bold' | 'italic' }> = [];
            if (hasBold) marks.push({ type: 'bold' });
            if (hasItalic) marks.push({ type: 'italic' });
            blocks.push({
                type: 'orderedList',
                content: cleanText,
                marks: marks.length > 0 ? marks : undefined,
            });
            continue;
        }

        // Regular paragraph
        const { cleanText, hasBold, hasItalic } = parseInlineMarks(line);
        const marks: Array<{ type: 'bold' | 'italic' }> = [];
        if (hasBold) marks.push({ type: 'bold' });
        if (hasItalic) marks.push({ type: 'italic' });
        blocks.push({
            type: 'paragraph',
            content: cleanText,
            marks: marks.length > 0 ? marks : undefined,
        });
    }

    return blocks;
}

/**
 * Convert parsed blocks to TipTap JSON content
 */
function blocksToTipTapContent(blocks: ParsedBlock[]): object[] {
    const content: object[] = [];
    let currentBulletList: object[] = [];
    let currentOrderedList: object[] = [];

    const flushBulletList = () => {
        if (currentBulletList.length > 0) {
            content.push({
                type: 'bulletList',
                content: currentBulletList,
            });
            currentBulletList = [];
        }
    };

    const flushOrderedList = () => {
        if (currentOrderedList.length > 0) {
            content.push({
                type: 'orderedList',
                content: currentOrderedList,
            });
            currentOrderedList = [];
        }
    };

    for (const block of blocks) {
        // Flush lists if switching types
        if (block.type !== 'bulletList') flushBulletList();
        if (block.type !== 'orderedList') flushOrderedList();

        switch (block.type) {
            case 'heading':
                content.push({
                    type: 'heading',
                    attrs: { level: block.level || 1 },
                    content: [{ type: 'text', text: block.content }],
                });
                break;

            case 'paragraph':
                const textNode: { type: string; text: string; marks?: object[] } = {
                    type: 'text',
                    text: block.content,
                };
                if (block.marks) {
                    textNode.marks = block.marks.map(m => ({ type: m.type }));
                }
                content.push({
                    type: 'paragraph',
                    content: [textNode],
                });
                break;

            case 'bulletList':
                const bulletTextNode: { type: string; text: string; marks?: object[] } = {
                    type: 'text',
                    text: block.content,
                };
                if (block.marks) {
                    bulletTextNode.marks = block.marks.map(m => ({ type: m.type }));
                }
                currentBulletList.push({
                    type: 'listItem',
                    content: [{
                        type: 'paragraph',
                        content: [bulletTextNode],
                    }],
                });
                break;

            case 'orderedList':
                const orderedTextNode: { type: string; text: string; marks?: object[] } = {
                    type: 'text',
                    text: block.content,
                };
                if (block.marks) {
                    orderedTextNode.marks = block.marks.map(m => ({ type: m.type }));
                }
                currentOrderedList.push({
                    type: 'listItem',
                    content: [{
                        type: 'paragraph',
                        content: [orderedTextNode],
                    }],
                });
                break;

            case 'horizontalRule':
                content.push({ type: 'horizontalRule' });
                break;
        }
    }

    // Flush any remaining lists
    flushBulletList();
    flushOrderedList();

    return content;
}

// =============================================================================
// EXTENSION
// =============================================================================

export const MarkdownPasteHandler = Extension.create({
    name: 'markdownPasteHandler',

    // Higher priority so it runs BEFORE PasteFirewall
    priority: 110,

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin<MarkdownPasteState>({
                key: markdownPasteKey,

                state: {
                    init: () => ({
                        lastPasteWasMarkdown: false,
                        blockCount: 0,
                    }),
                    apply(tr, value) {
                        const meta = tr.getMeta(markdownPasteKey);
                        if (meta) {
                            return meta;
                        }
                        return value;
                    },
                },

                props: {
                    handlePaste: (view, event) => {
                        const plainText = event.clipboardData?.getData('text/plain') || '';

                        // Check if plain text contains markdown syntax
                        // (Works for both web copy and plain text copy)
                        if (!plainText || !containsMarkdownSyntax(plainText)) {
                            return false; // Let default paste handle it
                        }

                        // Parse markdown
                        const blocks = parseMarkdownToBlocks(plainText);
                        if (blocks.length === 0) {
                            return false;
                        }

                        // Convert to TipTap content
                        const tipTapContent = blocksToTipTapContent(blocks);

                        // Insert content
                        event.preventDefault();
                        try {
                            editor.commands.insertContent(tipTapContent);

                            // Update state
                            view.dispatch(
                                view.state.tr.setMeta(markdownPasteKey, {
                                    lastPasteWasMarkdown: true,
                                    blockCount: blocks.length,
                                })
                            );

                            console.log('[MarkdownPaste] Converted', blocks.length, 'blocks from markdown');
                            return true;
                        } catch (error) {
                            console.error('[MarkdownPaste] Error inserting content:', error);
                            return false;
                        }
                    },
                },
            }),
        ];
    },
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get current markdown paste state
 */
export function getMarkdownPasteState(editor: { state: { doc: object } }): MarkdownPasteState | null {
    if (!editor?.state) return null;
    return markdownPasteKey.getState(editor.state as Parameters<typeof markdownPasteKey.getState>[0]) || null;
}

export default MarkdownPasteHandler;

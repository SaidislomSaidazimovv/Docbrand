'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const markdownPasteKey = new PluginKey('markdownPaste');

// =============================================================================
// Types
// =============================================================================

interface ParsedBlock {
    type: 'heading' | 'paragraph' | 'bulletList' | 'orderedList' | 'horizontalRule' | 'emptyLine' | 'blockquote';
    level?: number;
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textNodes?: any[];
}

// =============================================================================
// Inline Parser - Handles bold, italic, links
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInlineMarkdown(text: string): any[] {
    if (!text) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];
    let remaining = text;

    // Combined pattern for all inline elements
    // Order matters: process longer patterns first
    const inlinePattern = /(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\*([^*\n]+?)\*)|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)/g;

    let lastIndex = 0;
    let match;

    while ((match = inlinePattern.exec(text)) !== null) {
        // Add plain text before match
        if (match.index > lastIndex) {
            const plainText = text.slice(lastIndex, match.index);
            if (plainText) {
                result.push({ type: 'text', text: plainText });
            }
        }

        if (match[2]) {
            // ***bold+italic*** - group 2
            result.push({
                type: 'text',
                text: match[2],
                marks: [{ type: 'bold' }, { type: 'italic' }],
            });
        } else if (match[4]) {
            // **bold** - group 4
            result.push({
                type: 'text',
                text: match[4],
                marks: [{ type: 'bold' }],
            });
        } else if (match[6]) {
            // *italic* - group 6
            result.push({
                type: 'text',
                text: match[6],
                marks: [{ type: 'italic' }],
            });
        } else if (match[8] && match[9]) {
            // [text](url) - groups 8 (text) and 9 (url)
            result.push({
                type: 'text',
                text: match[8],
                marks: [{ type: 'link', attrs: { href: match[9] } }],
            });
        } else if (match[11]) {
            // `code` - group 11
            result.push({
                type: 'text',
                text: match[11],
                marks: [{ type: 'code' }],
            });
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining plain text
    if (lastIndex < text.length) {
        const plainText = text.slice(lastIndex);
        if (plainText) {
            result.push({ type: 'text', text: plainText });
        }
    }

    // If no matches found, return original text
    if (result.length === 0) {
        return [{ type: 'text', text }];
    }

    return result;
}

// =============================================================================
// Block Parser
// =============================================================================

function parseMarkdownToBlocks(text: string): ParsedBlock[] {
    // Normalize line endings
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    const blocks: ParsedBlock[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Empty line
        if (!line) {
            // Only add empty line if we have content before
            if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'emptyLine') {
                blocks.push({ type: 'emptyLine', content: '' });
            }
            continue;
        }

        // Horizontal rule
        if (/^(---|\*\*\*|___)$/.test(line)) {
            blocks.push({ type: 'horizontalRule', content: '' });
            continue;
        }

        // Heading
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
                content: headingMatch[2],
                textNodes: parseInlineMarkdown(headingMatch[2]),
            });
            continue;
        }

        // Blockquote
        const quoteMatch = line.match(/^>\s*(.*)$/);
        if (quoteMatch) {
            blocks.push({
                type: 'blockquote',
                content: quoteMatch[1],
                textNodes: parseInlineMarkdown(quoteMatch[1]),
            });
            continue;
        }

        // Bullet list
        const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
        if (bulletMatch) {
            blocks.push({
                type: 'bulletList',
                content: bulletMatch[1],
                textNodes: parseInlineMarkdown(bulletMatch[1]),
            });
            continue;
        }

        // Ordered list
        const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
        if (orderedMatch) {
            blocks.push({
                type: 'orderedList',
                content: orderedMatch[1],
                textNodes: parseInlineMarkdown(orderedMatch[1]),
            });
            continue;
        }

        // Regular paragraph with inline formatting
        blocks.push({
            type: 'paragraph',
            content: line,
            textNodes: parseInlineMarkdown(line),
        });
    }

    return blocks;
}

// =============================================================================
// Convert to TipTap Content
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blocksToTipTapContent(blocks: ParsedBlock[]): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentBulletList: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentOrderedList: any[] = [];

    const flushBulletList = () => {
        if (currentBulletList.length > 0) {
            content.push({ type: 'bulletList', content: currentBulletList });
            currentBulletList = [];
        }
    };

    const flushOrderedList = () => {
        if (currentOrderedList.length > 0) {
            content.push({ type: 'orderedList', content: currentOrderedList });
            currentOrderedList = [];
        }
    };

    for (const block of blocks) {
        if (block.type !== 'bulletList') flushBulletList();
        if (block.type !== 'orderedList') flushOrderedList();

        switch (block.type) {
            case 'heading':
                content.push({
                    type: 'heading',
                    attrs: { level: block.level || 1 },
                    content: block.textNodes && block.textNodes.length > 0
                        ? block.textNodes
                        : [{ type: 'text', text: block.content }],
                });
                break;

            case 'paragraph':
                content.push({
                    type: 'paragraph',
                    content: block.textNodes && block.textNodes.length > 0
                        ? block.textNodes
                        : [{ type: 'text', text: block.content }],
                });
                break;

            case 'emptyLine':
                content.push({ type: 'paragraph', content: [] });
                break;

            case 'blockquote':
                content.push({
                    type: 'blockquote',
                    content: [{
                        type: 'paragraph',
                        content: block.textNodes && block.textNodes.length > 0
                            ? block.textNodes
                            : [{ type: 'text', text: block.content }],
                    }],
                });
                break;

            case 'bulletList':
                currentBulletList.push({
                    type: 'listItem',
                    content: [{
                        type: 'paragraph',
                        content: block.textNodes && block.textNodes.length > 0
                            ? block.textNodes
                            : [{ type: 'text', text: block.content }],
                    }],
                });
                break;

            case 'orderedList':
                currentOrderedList.push({
                    type: 'listItem',
                    content: [{
                        type: 'paragraph',
                        content: block.textNodes && block.textNodes.length > 0
                            ? block.textNodes
                            : [{ type: 'text', text: block.content }],
                    }],
                });
                break;

            case 'horizontalRule':
                content.push({ type: 'horizontalRule' });
                break;
        }
    }

    flushBulletList();
    flushOrderedList();

    return content;
}

// =============================================================================
// Extension
// =============================================================================

export const MarkdownPasteHandler = Extension.create({
    name: 'markdownPasteHandler',

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin({
                key: markdownPasteKey,

                state: {
                    init: () => ({ lastPasteWasMarkdown: false, blockCount: 0 }),
                    apply(tr, value) {
                        const meta = tr.getMeta(markdownPasteKey);
                        return meta || value;
                    },
                },

                props: {
                    handlePaste: (view, event) => {
                        const plainText = event.clipboardData?.getData('text/plain') || '';

                        if (!plainText) return false;

                        // Parse markdown
                        const blocks = parseMarkdownToBlocks(plainText);
                        if (blocks.length === 0) return false;

                        console.log('[MarkdownPaste] Converted', blocks.length, 'blocks');

                        // Convert to TipTap format
                        const tipTapContent = blocksToTipTapContent(blocks);

                        // Insert content
                        event.preventDefault();
                        try {
                            editor.commands.insertContent(tipTapContent);
                            view.dispatch(view.state.tr.setMeta(markdownPasteKey, {
                                lastPasteWasMarkdown: true,
                                blockCount: blocks.length,
                            }));
                            return true;
                        } catch (error) {
                            console.error('[MarkdownPaste] Error:', error);
                            return false;
                        }
                    },
                },
            }),
        ];
    },
});

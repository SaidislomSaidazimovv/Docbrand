'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useUIStore } from '@/store/uiStore';

const markdownPasteKey = new PluginKey('markdownPaste');

// =============================================================================
// Types
// =============================================================================

interface ParsedBlock {
    type: 'heading' | 'paragraph' | 'bulletList' | 'orderedList' | 'horizontalRule' | 'emptyLine' | 'blockquote' | 'codeBlock';
    level?: number;
    language?: string;
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
// Semantic Auto-Heading Detection (conservative heuristic)
// =============================================================================

// Unicode-safe ALL CAPS: uppercase letters (Latin, Cyrillic, etc.), digits, spaces
const ALL_CAPS_PATTERN = /^[\p{Lu}\d\s]+$/u;
const HAS_LETTER_PATTERN = /\p{Lu}/u;
const HEADING_KEYWORD_PATTERN = /^(Chapter|Section|Appendix|Introduction|Overview|Summary|Background|Scope|Objectives?|Goals?)\b/i;
const NUMBERED_HEADING_PATTERN = /^\d+(\.\d+)*\.?\s+\S.+/;
const TRAILING_PUNCTUATION = /[.;:,]$/;

function detectAutoHeading(
    line: string,
    prevLineEmpty: boolean,
    isFirstLine: boolean,
    nextBodyLine: string | null,
): 'allCaps' | 'keyword' | 'numbered' | null {
    if (line.length > 60 || line.length < 2) return null;
    if (TRAILING_PUNCTUATION.test(line)) return null;
    // Context: next non-empty line must exist and NOT be ALL CAPS (heading must stand out)
    if (nextBodyLine === null) return null;
    if (ALL_CAPS_PATTERN.test(nextBodyLine) && HAS_LETTER_PATTERN.test(nextBodyLine)) return null;

    // ALL CAPS and keyword headings: require empty line before or first line
    if (prevLineEmpty || isFirstLine) {
        if (ALL_CAPS_PATTERN.test(line) && HAS_LETTER_PATTERN.test(line)) return 'allCaps';
        if (HEADING_KEYWORD_PATTERN.test(line)) return 'keyword';
    }

    // Numbered heading: relaxed — does NOT require prevLineEmpty
    // Stricter length (<=50) and next line must NOT also be numbered (avoid lists)
    if (line.length <= 50 && NUMBERED_HEADING_PATTERN.test(line) && !NUMBERED_HEADING_PATTERN.test(nextBodyLine!)) return 'numbered';

    return null;
}

// =============================================================================
// Code Detection Helpers
// =============================================================================

function stripFragmentMarkers(text: string): string {
    return text
        .replace(/<!--StartFragment-->/g, '')
        .replace(/<!--EndFragment-->/g, '')
        .trim();
}

function htmlContainsCode(html: string): boolean {
    if (!html) return false;
    return /<pre[\s>]/i.test(html) || /<code[\s>]/i.test(html);
}

function looksLikeCode(text: string): boolean {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return false;

    let codeSignals = 0;
    const trimmed = text.trim();

    // --- Language-specific detectors (strong = 2 points) ---

    // JSON: starts with { or [, has 2+ key patterns
    if (/^[\[{]/.test(trimmed) && (trimmed.match(/"[^"]+"\s*:/g) || []).length >= 2) codeSignals += 2;

    // HTML: paired tags OR 2+ lines starting with '<'
    if (/<([a-z][a-z0-9-]*)\b[^>]*>[\s\S]*<\/\1>/i.test(trimmed)) codeSignals += 2;
    else if (lines.filter(l => /^\s*</.test(l)).length >= 2) codeSignals += 2;

    // CSS: braces + property: value; pattern
    if (/[{]/.test(trimmed) && /[}]/.test(trimmed) && /[a-z-]+\s*:\s*[^;]+;/i.test(trimmed)) codeSignals += 2;

    // SQL: starts with keyword + contains complement
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\b/im.test(trimmed) &&
        /\b(FROM|WHERE|VALUES|SET|ORDER\s+BY|GROUP\s+BY|INTO|TABLE|AS)\b/i.test(trimmed)) codeSignals += 2;

    // Bash: 2+ lines starting with "$ " or common CLI commands
    const bashLines = lines.filter(l => /^\s*\$\s/.test(l) ||
        /^\s*(git|npm|pnpm|yarn|cd|ls|mkdir|rm|cat|curl|chmod|sudo|echo|docker|pip|python|node)\s/i.test(l)).length;
    if (bashLines >= 2) codeSignals += 2;

    // --- Generic code signals (JS/TS) ---

    // JS/TS keywords
    if (/\b(function|const|let|var|import|export|class|return|if|else|for|while)\s/m.test(text)) codeSignals += 2;
    if (/=>/m.test(text)) codeSignals += 2;
    if (/console\.\w+\s*\(/m.test(text)) codeSignals += 2;

    // --- Medium signals (1 point) ---

    // Indentation ratio >= 15%
    const indentedLines = lines.filter(l => /^(\t|  )/.test(l)).length;
    if (indentedLines / lines.length >= 0.15) codeSignals += 1;

    // Semicolons at end of lines
    const semicolonLines = lines.filter(l => /;\s*$/.test(l)).length;
    if (semicolonLines / lines.length > 0.2) codeSignals += 1;

    // Brace lines
    const braceLines = lines.filter(l => /[{}]/.test(l)).length;
    if (braceLines >= 2) codeSignals += 1;

    // Adaptive threshold: 3+ lines need 2 points, <3 lines need 3 points
    const threshold = lines.length >= 3 ? 2 : 3;
    return codeSignals >= threshold;
}

// =============================================================================
// Block Parser
// =============================================================================

interface ParseResult {
    blocks: ParsedBlock[];
    autoHeadingCount: number;
}

function parseMarkdownToBlocks(text: string): ParseResult {
    // Normalize line endings
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    const blocks: ParsedBlock[] = [];
    let autoHeadingCount = 0;
    let hasAnyHeading = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Fenced code block (``` with optional language)
        const fenceMatch = line.match(/^```(\w*)$/);
        if (fenceMatch) {
            const language = fenceMatch[1] || '';
            const codeLines: string[] = [];
            i++;
            while (i < lines.length) {
                if (lines[i].trim() === '```') break;
                codeLines.push(lines[i]);
                i++;
            }
            blocks.push({
                type: 'codeBlock',
                language,
                content: codeLines.join('\n'),
            });
            continue;
        }

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

        // Markdown heading (# syntax)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            hasAnyHeading = true;
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

        // Semantic auto-heading detection (before ordered list so "1. Scope" can be a heading)
        const isFirstLine = blocks.length === 0;
        const prevBlockIsEmpty = blocks.length > 0 && blocks[blocks.length - 1].type === 'emptyLine';
        let nextBodyLine: string | null = null;
        for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j].trim();
            if (next) { nextBodyLine = next; break; }
        }
        const autoType = detectAutoHeading(line, prevBlockIsEmpty, isFirstLine, nextBodyLine);
        const prevNonEmpty = [...blocks].reverse().find(b => b.type !== 'emptyLine');
        if (autoType && !(autoType === 'numbered' && prevNonEmpty?.type === 'orderedList')) {
            let level: number;
            if (!hasAnyHeading) {
                level = 1;
            } else {
                level = 2;
            }
            hasAnyHeading = true;
            autoHeadingCount++;
            blocks.push({
                type: 'heading',
                level,
                content: line,
                textNodes: parseInlineMarkdown(line),
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

    return { blocks, autoHeadingCount };
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

            case 'codeBlock':
                content.push({
                    type: 'codeBlock',
                    attrs: { language: block.language || '' },
                    content: block.content
                        ? [{ type: 'text', text: block.content }]
                        : [],
                });
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
                        const rawText = event.clipboardData?.getData('text/plain') || '';
                        const html = event.clipboardData?.getData('text/html') || '';

                        if (!rawText) return false;

                        // Strip clipboard fragment markers
                        const plainText = stripFragmentMarkers(rawText);
                        if (!plainText) return false;

                        // Detect code: from HTML clipboard or plain text heuristic
                        const codeFromHtml = htmlContainsCode(html);
                        const codeFromText = !codeFromHtml && looksLikeCode(plainText);

                        if (codeFromHtml || codeFromText) {
                            console.log('[MarkdownPaste] Detected code:', codeFromHtml ? 'HTML <pre>/<code>' : 'text heuristic');
                            event.preventDefault();
                            try {
                                editor.commands.insertContent({
                                    type: 'codeBlock',
                                    attrs: { language: '' },
                                    content: [{ type: 'text', text: plainText }],
                                });
                                useUIStore.getState().showPasteToast('Content pasted');
                                return true;
                            } catch (error) {
                                console.error('[MarkdownPaste] Error inserting code block:', error);
                                return false;
                            }
                        }

                        // Parse markdown (existing behavior)
                        const { blocks, autoHeadingCount } = parseMarkdownToBlocks(plainText);
                        if (blocks.length === 0) return false;

                        console.log('[MarkdownPaste] Converted', blocks.length, 'blocks', autoHeadingCount, 'auto-headings');

                        // Convert to TipTap format
                        const tipTapContent = blocksToTipTapContent(blocks);

                        // Insert content
                        event.preventDefault();
                        try {
                            editor.commands.insertContent(tipTapContent);
                            view.dispatch(
                                view.state.tr
                                    .setMeta(markdownPasteKey, {
                                        lastPasteWasMarkdown: true,
                                        blockCount: blocks.length,
                                    })
                                    .setMeta('addToHistory', false)
                            );

                            // Show undo toast if auto-headings were detected
                            if (autoHeadingCount > 0) {
                                useUIStore.getState().showAutoHeadingToast(autoHeadingCount);
                            } else {
                                useUIStore.getState().showPasteToast('Content pasted');
                            }

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

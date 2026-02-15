/**
 * Paste Firewall Extension for TipTap
 * 
 * Sanitizes pasted content and shows changes in UI:
 * - Strips inline styles (font-family, color, font-size)
 * - Preserves semantic formatting (bold, italic, underline, links)
 * - Normalizes formatting
 * - Stores state for UI display
 * 
 * IMPORTANT: This handler MUST process all HTML paste events to preserve
 * inline formatting like bold/italic. If we pass to MarkdownPasteHandler,
 * it will use plainText and lose all HTML formatting.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// =============================================================================
// TYPES
// =============================================================================

export interface PasteChange {
    icon: string;
    text: string;
}

export interface PasteFirewallState {
    open: boolean;
    beforeHtml: string;
    afterHtml: string;
    changes: PasteChange[];
    plainText: string;
}

// =============================================================================
// PLUGIN KEY (for external access)
// =============================================================================

export const pasteFirewallKey = new PluginKey<PasteFirewallState>('pasteFirewall');

// =============================================================================
// HTML SANITIZER - Preserves semantic structure while removing styles
// =============================================================================

function sanitizePastedHtml(html: string): { afterHtml: string; changes: PasteChange[] } {
    const changes: PasteChange[] = [];

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Track what we're removing
    let fontFamilyRemoved = false;
    let colorRemoved = false;
    let fontSizeRemoved = false;
    let classesRemoved = false;
    let backgroundRemoved = false;

    // Strip inline styles from ALL elements
    doc.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style') || '';

        if (style.includes('font-family') && !fontFamilyRemoved) {
            changes.push({ icon: '🔤', text: 'Font family removed' });
            fontFamilyRemoved = true;
        }
        if (style.includes('color') && !colorRemoved) {
            changes.push({ icon: '🎨', text: 'Text colors removed' });
            colorRemoved = true;
        }
        if (style.includes('background') && !backgroundRemoved) {
            changes.push({ icon: '🖌️', text: 'Background colors removed' });
            backgroundRemoved = true;
        }
        if (style.includes('font-size') && !fontSizeRemoved) {
            changes.push({ icon: '📏', text: 'Font sizes normalized' });
            fontSizeRemoved = true;
        }

        el.removeAttribute('style');
    });

    // Strip classes
    doc.querySelectorAll('[class]').forEach(el => {
        if (!classesRemoved) {
            changes.push({ icon: '🏷️', text: 'CSS classes removed' });
            classesRemoved = true;
        }
        el.removeAttribute('class');
    });

    // Remove unwanted elements
    doc.querySelectorAll('meta, style, link, script, o\\:p, xml').forEach(el => el.remove());

    // Block-level tags to preserve (semantic structure)
    const blockTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE'];

    // Inline tags to preserve (semantic formatting)
    const inlineTags = ['STRONG', 'B', 'EM', 'I', 'U', 'A', 'CODE', 'S', 'STRIKE', 'SUB', 'SUP'];

    // Allowed tags (both block and inline)
    const allowedTags = [...blockTags, ...inlineTags];

    // Function to unwrap a tag (keep children, remove tag)
    const unwrapElement = (el: Element) => {
        const parent = el.parentNode;
        if (parent) {
            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
        }
    };

    // Convert DIV and SPAN to appropriate tags or unwrap
    doc.querySelectorAll('div, span').forEach(el => {
        // If has block children, replace with fragment
        // If has only inline content, unwrap to preserve text
        unwrapElement(el);
    });

    // Remove non-semantic tags
    const allElements = Array.from(doc.body.querySelectorAll('*'));
    for (const el of allElements) {
        if (!allowedTags.includes(el.tagName)) {
            unwrapElement(el);
        }
    }

    // Get final HTML
    let result = doc.body.innerHTML;

    // Clean up excessive whitespace but preserve structure
    result = result.replace(/\s{2,}/g, ' ').trim();

    return {
        afterHtml: result,
        changes,
    };
}


// =============================================================================
// EXTENSION
// =============================================================================

export const PasteFirewall = Extension.create({
    name: 'pasteFirewall',

    // Set higher priority to run before MarkdownPasteHandler
    priority: 1000,

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin<PasteFirewallState>({
                key: pasteFirewallKey,

                state: {
                    init: () => ({
                        open: false,
                        beforeHtml: '',
                        afterHtml: '',
                        changes: [],
                        plainText: '',
                    }),
                    apply(tr, value) {
                        const meta = tr.getMeta(pasteFirewallKey);
                        if (meta?.type === 'OPEN') {
                            return {
                                open: true,
                                beforeHtml: meta.beforeHtml,
                                afterHtml: meta.afterHtml,
                                changes: meta.changes,
                                plainText: meta.plainText,
                            };
                        }
                        if (meta?.type === 'CLOSE') {
                            return {
                                open: false,
                                beforeHtml: '',
                                afterHtml: '',
                                changes: [],
                                plainText: '',
                            };
                        }
                        return value;
                    },
                },

                props: {
                    handlePaste: (view, event) => {
                        const html = event.clipboardData?.getData('text/html') || '';
                        const plainText = event.clipboardData?.getData('text/plain') || '';

                        // If we have HTML content, process it to preserve formatting
                        // This includes bold, italic, underline, links, etc.
                        if (html && html.trim().length > 0) {
                            // Sanitize HTML (removes styles but preserves semantic tags)
                            const { afterHtml, changes } = sanitizePastedHtml(html);

                            // If changes detected, store state (UI can show notification)
                            if (changes.length > 0) {
                                view.dispatch(
                                    view.state.tr
                                        .setMeta(pasteFirewallKey, {
                                            type: 'OPEN',
                                            beforeHtml: html,
                                            afterHtml,
                                            changes,
                                            plainText,
                                        })
                                        .setMeta('addToHistory', false)
                                );
                            }

                            // Insert sanitized HTML content
                            event.preventDefault();

                            // Debug: log what we're inserting
                            console.log('[PasteFirewall] Original HTML:', html);
                            console.log('[PasteFirewall] Sanitized HTML:', afterHtml);

                            // Use TipTap's insertContent with parseOptions to prevent extra paragraphs
                            editor.commands.insertContent(afterHtml, {
                                parseOptions: {
                                    preserveWhitespace: false,
                                }
                            });

                            console.log('[PasteFirewall] Inserted HTML with formatting preserved');
                            return true;
                        }

                        // No HTML - let MarkdownPasteHandler process plain text
                        // (This is for pasting from plain text sources)
                        return false;
                    },
                },
            }),
        ];
    },
});

// =============================================================================
// HELPERS
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function closePasteFirewall(editor: any): void {
    if (!editor?.view) return;

    editor.view.dispatch(
        editor.state.tr
            .setMeta(pasteFirewallKey, { type: 'CLOSE' })
            .setMeta('addToHistory', false)
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPasteFirewallState(editor: any): PasteFirewallState | null {
    if (!editor?.state) return null;
    return pasteFirewallKey.getState(editor.state) || null;
}

export default PasteFirewall;

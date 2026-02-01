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
// HTML SANITIZER - Preserves semantic tags like <strong>, <em>, <a>
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

    // Strip inline styles from ALL elements
    doc.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style') || '';

        if (style.includes('font-family') && !fontFamilyRemoved) {
            changes.push({ icon: '🔤', text: 'Font family removed' });
            fontFamilyRemoved = true;
        }
        if ((style.includes('color') || style.includes('background')) && !colorRemoved) {
            changes.push({ icon: '🎨', text: 'Inline colors removed' });
            colorRemoved = true;
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

    // Strip MS Office specific elements and metadata
    doc.querySelectorAll('meta, style, link, script, o\\:p, xml, br').forEach(el => el.remove());

    // Inline tags to preserve (semantic formatting)
    const inlineTags = ['STRONG', 'B', 'EM', 'I', 'U', 'A', 'CODE', 'S', 'STRIKE', 'SUB', 'SUP'];

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

    // Unwrap all block-level and non-semantic inline tags
    // Keep only: strong, em, a, u, code, etc.
    const allElements = Array.from(doc.body.querySelectorAll('*'));
    for (const el of allElements) {
        if (!inlineTags.includes(el.tagName)) {
            unwrapElement(el);
        }
    }

    // Get final HTML - should only have text and inline formatting
    let result = doc.body.innerHTML;

    // Clean up multiple spaces
    result = result.replace(/\s+/g, ' ').trim();

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

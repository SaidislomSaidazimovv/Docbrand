/**
 * Paste Firewall Extension for TipTap
 * 
 * Sanitizes pasted content and shows changes in UI:
 * - Strips inline styles (font-family, color, font-size)
 * - Normalizes formatting
 * - Stores state for UI display
 * 
 * @see docs/Skills/phase-3-4-architecture/SKILL.md
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
// HTML SANITIZER
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

    // Strip inline styles
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

    // Strip MS Office specific elements
    doc.querySelectorAll('meta, style, link, script, o\\:p').forEach(el => el.remove());

    return {
        afterHtml: doc.body.innerHTML,
        changes,
    };
}

// =============================================================================
// EXTENSION
// =============================================================================

export const PasteFirewall = Extension.create({
    name: 'pasteFirewall',

    addProseMirrorPlugins() {
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

                        // If no HTML or very simple paste, let other handlers process it
                        // (MarkdownPasteHandler will check for markdown syntax)
                        if (!html || html.length < 50) {
                            return false; // Pass to next handler (MarkdownPasteHandler)
                        }

                        // Sanitize HTML
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

                        // Insert sanitized content
                        event.preventDefault();
                        const { state, dispatch } = view;
                        const tr = state.tr.insertText(plainText, state.selection.from, state.selection.to);
                        dispatch(tr);

                        return true;
                    },
                },
            }),
        ];
    },
});

// =============================================================================
// HELPERS
// =============================================================================

export function closePasteFirewall(editor: any): void {
    if (!editor?.view) return;

    editor.view.dispatch(
        editor.state.tr
            .setMeta(pasteFirewallKey, { type: 'CLOSE' })
            .setMeta('addToHistory', false)
    );
}

export function getPasteFirewallState(editor: any): PasteFirewallState | null {
    if (!editor?.state) return null;
    return pasteFirewallKey.getState(editor.state) || null;
}

export default PasteFirewall;

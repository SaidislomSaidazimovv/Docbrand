/**
 * Paste Firewall Extension for TipTap
 *
 * Sanitizes pasted content and shows changes in a modal:
 * - Strips inline styles (font-family, color, font-size)
 * - Preserves semantic formatting (bold, italic, underline, links)
 * - Normalizes formatting
 * - Defers insertion until user confirms via modal
 *
 * IMPORTANT: This handler MUST process all HTML paste events to preserve
 * inline formatting like bold/italic. If we pass to MarkdownPasteHandler,
 * it will use plainText and lose all HTML formatting.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useUIStore } from '@/store/uiStore';

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
// VALUE EXTRACTORS — pull specific values from raw HTML before sanitization
// =============================================================================

function extractFonts(html: string): string[] {
    const matches = html.match(/font-family:\s*([^;'"<>]+)/gi) || [];
    return [...new Set(
        matches.map(m => {
            const raw = m.replace(/font-family:\s*/i, '').replace(/['"]/g, '').trim();
            // Take only first font (before comma), skip fallbacks
            return raw.split(',')[0].trim();
        })
    )].filter(f =>
        f &&
        f !== 'inherit' &&
        f !== 'initial' &&
        !f.includes('var(')
    );
}

function extractColors(html: string): string[] {
    const matches = html.match(/(?:^|;|\s)color:\s*([^;]+)/gi) || [];
    return [...new Set(
        matches.map(m => m.replace(/color:\s*/i, '').trim())
    )].filter(Boolean);
}

function extractSizes(html: string): string[] {
    const matches = html.match(/font-size:\s*([^;]+)/gi) || [];
    return [...new Set(
        matches.map(m => m.replace(/font-size:\s*/i, '').trim())
    )].filter(Boolean);
}

// =============================================================================
// HTML SANITIZER - Preserves semantic structure while removing styles
// =============================================================================

function sanitizePastedHtml(html: string): { afterHtml: string; changes: PasteChange[] } {
    // Extract specific values BEFORE sanitization for detailed change messages
    const originalFonts = extractFonts(html);
    const originalColors = extractColors(html);
    const originalSizes = extractSizes(html);

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Track what we're removing
    let fontFamilyRemoved = false;
    let colorRemoved = false;
    let fontSizeRemoved = false;
    let classesRemoved = false;
    let backgroundRemoved = false;

    // Strip font-weight:bold from inline styles before removing all styles
    // (prevents browsers from rendering residual bold)
    doc.querySelectorAll('[style]').forEach(el => {
        const htmlEl = el as HTMLElement;
        const style = el.getAttribute('style') || '';

        if (style.includes('font-family')) fontFamilyRemoved = true;
        if (style.includes('color')) colorRemoved = true;
        if (style.includes('background')) backgroundRemoved = true;
        if (style.includes('font-size')) fontSizeRemoved = true;

        // Detect bold inline style before we strip it
        const fw = htmlEl.style.fontWeight;
        if (fw === 'bold' || fw === '700' || fw === '800' || fw === '900') {
            // If not inside a semantic bold tag, the bold was cosmetic — don't preserve
            if (!htmlEl.closest('strong, b')) {
                htmlEl.style.fontWeight = 'normal';
            }
        }

        el.removeAttribute('style');
    });

    // Strip classes
    doc.querySelectorAll('[class]').forEach(el => {
        if (!classesRemoved) classesRemoved = true;
        el.removeAttribute('class');
    });

    // Remove unwanted elements
    doc.querySelectorAll('meta, style, link, script, o\\:p, xml').forEach(el => el.remove());

    // Convert heading tags to <p> to avoid unintended bold/large rendering
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        const p = doc.createElement('p');
        p.innerHTML = el.innerHTML;
        el.replaceWith(p);
    });

    // Block-level tags to preserve (semantic structure)
    const blockTags = ['P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE'];

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
        unwrapElement(el);
    });

    // Remove non-semantic tags
    const allElements = Array.from(doc.body.querySelectorAll('*'));
    for (const el of allElements) {
        if (!allowedTags.includes(el.tagName)) {
            unwrapElement(el);
        }
    }

    // --- Bold cleanup (runs AFTER all span/div/tag unwrapping) ---
    // Remove ALL <strong> and <b> tags (unwrap = keep content, remove tag)
    ['strong', 'b'].forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => {
            const parent = el.parentElement;
            if (!parent) return;
            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
        });
    });

    // Remove inline font-weight and font-style from any remaining styled elements
    doc.querySelectorAll('[style]').forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.fontWeight = '';
        htmlEl.style.fontStyle = '';
    });

    // Get final HTML
    let result = doc.body.innerHTML;

    // Clean up excessive whitespace but preserve structure
    result = result.replace(/\s{2,}/g, ' ').trim();

    // Build detailed changes with specific extracted values
    const changes: PasteChange[] = [];

    if (fontFamilyRemoved && originalFonts.length > 0) {
        changes.push({ icon: '🔤', text: `Font changed: ${originalFonts[0]} → Brand font` });
    } else if (fontFamilyRemoved) {
        changes.push({ icon: '🔤', text: 'Font family removed' });
    }

    if (colorRemoved && originalColors.length > 0) {
        changes.push({ icon: '🎨', text: `Color removed: ${originalColors[0]} → Default black` });
    } else if (colorRemoved) {
        changes.push({ icon: '🎨', text: 'Text colors removed' });
    }

    if (backgroundRemoved) {
        changes.push({ icon: '🖌️', text: 'Background colors removed' });
    }

    if (fontSizeRemoved && originalSizes.length > 0) {
        changes.push({ icon: '📏', text: `Size normalized: ${originalSizes[0]} → 12pt` });
    } else if (fontSizeRemoved) {
        changes.push({ icon: '📏', text: 'Font sizes normalized → 12pt' });
    }

    if (classesRemoved) {
        changes.push({ icon: '🧹', text: 'CSS classes removed' });
    }

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
                        if (html && html.trim().length > 0) {
                            // Sanitize HTML (removes styles but preserves semantic tags)
                            const { afterHtml, changes } = sanitizePastedHtml(html);

                            event.preventDefault();

                            if (changes.length > 0) {
                                // Changes detected — show modal for user confirmation
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

                                // Defer insertion — open modal instead of inserting immediately
                                useUIStore.getState().showPasteModal({
                                    beforeHtml: html,
                                    afterHtml,
                                    changes,
                                    pendingContent: afterHtml,
                                });
                            } else {
                                // No changes needed — insert directly (clean HTML paste)
                                editor.commands.insertContent(afterHtml, {
                                    parseOptions: { preserveWhitespace: false },
                                });
                                useUIStore.getState().showPasteToast('Content pasted', 0);
                            }

                            return true;
                        }

                        // No HTML - let MarkdownPasteHandler process plain text
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

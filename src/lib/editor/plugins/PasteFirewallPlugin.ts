// lib/editor/plugins/PasteFirewallPlugin.ts
// Exactly as specified in docs/Skills/phase-3-4-architecture/SKILL.md

import { Plugin, PluginKey } from '@tiptap/pm/state'

type PasteFirewallState =
    | { open: false }
    | {
        open: true
        beforeHtml: string
        afterHtml: string
        changes: Array<{ icon: string; text: string }>
        slice: any  // ProseMirror Slice to insert on confirm
    }

export const pasteFirewallKey = new PluginKey<PasteFirewallState>('pasteFirewall')

// Sanitizer function exactly as documented
function sanitizePastedHtml(html: string): { afterHtml: string; changes: Array<{ icon: string; text: string }> } {
    const changes: Array<{ icon: string; text: string }> = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Strip inline styles
    doc.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style') || ''
        if (style.includes('font-family')) {
            changes.push({ icon: '🔤', text: 'Font family removed' })
        }
        if (style.includes('color')) {
            changes.push({ icon: '🎨', text: 'Inline color removed' })
        }
        if (style.includes('font-size')) {
            changes.push({ icon: '📏', text: 'Font size normalized' })
        }
        el.removeAttribute('style')
    })

    // More sanitization...

    return {
        afterHtml: doc.body.innerHTML,
        changes: [...new Set(changes.map(c => JSON.stringify(c)))].map(s => JSON.parse(s)),
    }
}

export const PasteFirewallPlugin = new Plugin<PasteFirewallState>({
    key: pasteFirewallKey,

    state: {
        init: () => ({ open: false }),
        apply(tr, value) {
            const meta = tr.getMeta(pasteFirewallKey)
            if (meta?.type === 'OPEN') {
                return {
                    open: true,
                    beforeHtml: meta.beforeHtml,
                    afterHtml: meta.afterHtml,
                    changes: meta.changes,
                    slice: meta.slice,
                }
            }
            if (meta?.type === 'CLOSE') {
                return { open: false }
            }
            return value
        },
    },

    props: {
        handlePaste(view, event, slice) {
            const html = event.clipboardData?.getData('text/html') || ''

            // Skip if no HTML
            if (!html) return false

            // Sanitize
            const { afterHtml, changes } = sanitizePastedHtml(html)

            // If changes detected, show modal
            if (changes.length > 0) {
                view.dispatch(
                    view.state.tr
                        .setMeta(pasteFirewallKey, {
                            type: 'OPEN',
                            beforeHtml: html,
                            afterHtml,
                            changes,
                            slice,
                        })
                        .setMeta('addToHistory', false)
                )
                return true  // Prevent default paste
            }

            return false  // Allow normal paste
        },
    },
})

// Export type for external use
export type { PasteFirewallState }

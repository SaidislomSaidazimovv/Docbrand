// lib/editor/plugins/QualityScannerPlugin.ts
// Exactly as specified in docs/Skills/phase-3-4-architecture/SKILL.md

import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet, Decoration } from '@tiptap/pm/view'

type Severity = 'critical' | 'warning' | 'passed'

type QualityIssue = {
    id: string
    severity: Severity
    rule: 'phone' | 'insecure_url' | 'unverified_claim'
    message: string
    blockId?: string
    from: number        // doc position for highlight start
    to: number          // doc position for highlight end
    excerpt?: string
}

type QualityState = {
    running: boolean
    progress: number    // 0..100
    issues: QualityIssue[]
    score: number       // 0..100
    decorations: DecorationSet
}

export const qualityKey = new PluginKey<QualityState>('qualityScanner')

export const QualityScannerPlugin = new Plugin<QualityState>({
    key: qualityKey,

    state: {
        init: () => ({
            running: false,
            progress: 0,
            issues: [],
            score: 100,
            decorations: DecorationSet.empty,
        }),

        apply(tr, value, oldState, newState) {
            const meta = tr.getMeta(qualityKey)

            if (meta?.type === 'SET_RESULTS') {
                // Create decorations for issues
                const decorations = meta.issues.map((issue: QualityIssue) =>
                    Decoration.inline(issue.from, issue.to, {
                        class: 'issue-highlight',
                        'data-issue-id': issue.id,
                    })
                )

                return {
                    running: false,
                    progress: 100,
                    issues: meta.issues,
                    score: meta.score,
                    decorations: DecorationSet.create(newState.doc, decorations),
                }
            }

            if (meta?.type === 'START_SCAN') {
                return { ...value, running: true, progress: 0 }
            }

            if (meta?.type === 'UPDATE_PROGRESS') {
                return { ...value, progress: meta.progress }
            }

            // Map decorations through edits
            if (tr.docChanged && value.decorations) {
                return {
                    ...value,
                    decorations: value.decorations.map(tr.mapping, tr.doc),
                }
            }

            return value
        },
    },

    props: {
        decorations(state) {
            return qualityKey.getState(state)?.decorations ?? DecorationSet.empty
        },
    },
})

// Export types for external use
export type { QualityIssue, QualityState, Severity }

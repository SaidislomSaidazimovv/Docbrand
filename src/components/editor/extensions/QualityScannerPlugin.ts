/**
 * Quality Scanner Plugin
 * 
 * Scans document for quality issues (phone numbers, insecure URLs, unverified claims)
 * Results stored in plugin state, not document attrs (no undo pollution)
 * 
 * @see docs/Skills/phase-3-4-architecture/SKILL.md
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Editor } from '@tiptap/react';
import { Node } from '@tiptap/pm/model';

// =============================================================================
// TYPES
// =============================================================================

export type Severity = 'critical' | 'warning' | 'passed';

export interface QualityIssue {
    id: string;
    severity: Severity;
    rule: 'phone' | 'insecure_url' | 'unverified_claim';
    message: string;
    blockId?: string;
    from: number;        // doc position for highlight start
    to: number;          // doc position for highlight end
    excerpt?: string;
}

export interface QualityState {
    running: boolean;
    progress: number;    // 0..100
    issues: QualityIssue[];
    score: number;       // 0..100
    decorations: DecorationSet;
}

// =============================================================================
// PLUGIN
// =============================================================================

export const qualityKey = new PluginKey<QualityState>('qualityScanner');

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
            const meta = tr.getMeta(qualityKey);

            if (meta?.type === 'SET_RESULTS') {
                // Create decorations for issues
                const decorations = meta.issues.map((issue: QualityIssue) =>
                    Decoration.inline(issue.from, issue.to, {
                        class: `issue-highlight issue-${issue.severity}`,
                        'data-issue-id': issue.id,
                    })
                );

                return {
                    running: false,
                    progress: 100,
                    issues: meta.issues,
                    score: meta.score,
                    decorations: DecorationSet.create(newState.doc, decorations),
                };
            }

            if (meta?.type === 'START_SCAN') {
                return { ...value, running: true, progress: 0 };
            }

            if (meta?.type === 'UPDATE_PROGRESS') {
                return { ...value, progress: meta.progress };
            }

            if (meta?.type === 'CLEAR') {
                return {
                    running: false,
                    progress: 0,
                    issues: [],
                    score: 100,
                    decorations: DecorationSet.empty,
                };
            }

            // Map decorations through edits (keep highlights attached to content)
            if (tr.docChanged && value.decorations) {
                return {
                    ...value,
                    decorations: value.decorations.map(tr.mapping, tr.doc),
                };
            }

            return value;
        },
    },

    props: {
        decorations(state) {
            return qualityKey.getState(state)?.decorations ?? DecorationSet.empty;
        },
    },
});

// =============================================================================
// SCAN EXECUTION (off the transaction hot path)
// =============================================================================

export async function runQualityScan(editor: Editor): Promise<void> {
    if (!editor) return;

    // 1. Start scan (UI feedback)
    editor.view.dispatch(
        editor.state.tr
            .setMeta(qualityKey, { type: 'START_SCAN' })
            .setMeta('addToHistory', false)
    );

    // 2. Run scan OFF the transaction hot path
    const doc = editor.state.doc;
    const issues: QualityIssue[] = [];

    // Scan each textblock
    doc.descendants((node: Node, pos: number) => {
        if (node.isTextblock) {
            const text = node.textContent;

            // Phone numbers (critical)
            const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
            let match;
            while ((match = phoneRegex.exec(text)) !== null) {
                issues.push({
                    id: `phone-${pos}-${match.index}`,
                    severity: 'critical',
                    rule: 'phone',
                    message: 'Phone number detected - remove before submission',
                    from: pos + 1 + match.index,
                    to: pos + 1 + match.index + match[0].length,
                    excerpt: match[0],
                });
            }

            // Insecure URLs (critical)
            const httpRegex = /http:\/\/[^\s]+/g;
            while ((match = httpRegex.exec(text)) !== null) {
                issues.push({
                    id: `url-${pos}-${match.index}`,
                    severity: 'critical',
                    rule: 'insecure_url',
                    message: 'Insecure URL (http://) - use https://',
                    from: pos + 1 + match.index,
                    to: pos + 1 + match.index + match[0].length,
                    excerpt: match[0],
                });
            }

            // Unverified claims (warning)
            const claimRegex = /\b(guarantee|always|99\.99%|100%|never fails|best in class)\b/gi;
            while ((match = claimRegex.exec(text)) !== null) {
                issues.push({
                    id: `claim-${pos}-${match.index}`,
                    severity: 'warning',
                    rule: 'unverified_claim',
                    message: `Unverified claim: "${match[0]}" - add supporting evidence`,
                    from: pos + 1 + match.index,
                    to: pos + 1 + match.index + match[0].length,
                    excerpt: match[0],
                });
            }
        }
    });

    // 3. Calculate score
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const score = Math.max(0, 100 - (criticalCount * 15) - (warningCount * 5));

    // 4. Dispatch results (ONE transaction, no history)
    editor.view.dispatch(
        editor.state.tr
            .setMeta(qualityKey, { type: 'SET_RESULTS', issues, score })
            .setMeta('addToHistory', false)
    );
}

// =============================================================================
// NAVIGATION HELPER
// =============================================================================

export function scrollToIssue(editor: Editor, issue: QualityIssue): void {
    if (!editor) return;

    editor.chain()
        .focus()
        .setTextSelection(issue.from)
        .scrollIntoView()
        .run();
}

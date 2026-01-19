/**
 * RequirementLinking Extension
 * 
 * TipTap extension for linking requirements to blocks.
 * Manages LinkIndex and provides methods for linking.
 * 
 * @see DocBrand 001 process/part-2.2/path-e-architecture.md
 * 
 * Architecture:
 * - Document attrs are CANONICAL (source of truth)
 * - LinkIndex is derived cache for fast lookups
 * - onCreate rebuilds LinkIndex from document
 * - onTransaction applies incremental updates
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { linkIndex } from '../LinkIndex';

// =============================================================================
// TYPES
// =============================================================================

export interface RequirementLinkingOptions {
    onLinkAdded?: (blockId: string, reqId: string) => void;
    onLinkRemoved?: (blockId: string, reqId: string) => void;
}

export const RequirementLinkingKey = new PluginKey('requirementLinking');

// =============================================================================
// EXTENSION
// =============================================================================

export const RequirementLinking = Extension.create<RequirementLinkingOptions>({
    name: 'requirementLinking',

    addOptions() {
        return {
            onLinkAdded: undefined,
            onLinkRemoved: undefined,
        };
    },

    addStorage() {
        return {
            linkIndex,
        };
    },

    onCreate() {
        // Build initial index from document
        const doc = this.editor.getJSON();
        linkIndex.rebuildFromDocument(doc);
        console.log('[RequirementLinking] Initial index built, total links:', linkIndex.getTotalLinkCount());
    },

    onTransaction({ transaction }) {
        const meta = transaction.getMeta(RequirementLinkingKey);
        if (meta?.type === 'linkChange') {
            // Incremental update
            linkIndex.applyTransactionUpdate({
                blockId: meta.blockId,
                addedLinks: meta.addedLinks,
                removedLinks: meta.removedLinks,
            });
        }
    },

    onDestroy() {
        // Verify sync before teardown (dev check)
        if (process.env.NODE_ENV === 'development') {
            const isValid = linkIndex.verifySyncWithDocument(this.editor.getJSON());
            if (!isValid) {
                console.error('[RequirementLinking] INDEX DRIFT DETECTED on destroy');
            }
        }
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: RequirementLinkingKey,
            }),
        ];
    },
});

export default RequirementLinking;

/**
 * BlockIndex Plugin
 * 
 * Maintains a mapping of blockId → position for fast lookups.
 * Used for navigation, selection, and gutter positioning.
 * 
 * @see DocBrand 001 process/feature-1.2/decision.md
 * 
 * This is PURE STATE - no DOMRect storage (per Scout guidance).
 * DOMRect measurement happens separately for gutter positioning.
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// =============================================================================
// TYPES
// =============================================================================

export interface BlockPosition {
    pos: number;
    nodeSize: number;
    type: string;
    hasLinks: boolean;
}

export interface BlockIndexState {
    blocks: Map<string, BlockPosition>;
    version: number;
}

export const BlockIndexPluginKey = new PluginKey<BlockIndexState>('blockIndex');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build block index from document
 */
function buildBlockIndex(doc: ProseMirrorNode): Map<string, BlockPosition> {
    const blocks = new Map<string, BlockPosition>();

    doc.descendants((node, pos) => {
        if (node.type.name === 'docBlock' && node.attrs.id) {
            const linkedReqs = node.attrs.linkedRequirements || [];

            blocks.set(node.attrs.id as string, {
                pos,
                nodeSize: node.nodeSize,
                type: (node.attrs.blockType as string) || 'paragraph',
                hasLinks: Array.isArray(linkedReqs) && linkedReqs.length > 0,
            });

            // Don't descend into docBlock children for index
            return false;
        }

        return true;
    });

    return blocks;
}

// =============================================================================
// BLOCK INDEX EXTENSION
// =============================================================================

export const BlockIndex = Extension.create({
    name: 'blockIndex',

    addStorage() {
        return {
            blocks: new Map<string, BlockPosition>(),
        };
    },

    addProseMirrorPlugins() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const extension = this;

        return [
            new Plugin<BlockIndexState>({
                key: BlockIndexPluginKey,

                state: {
                    init: (_, state) => {
                        const blocks = buildBlockIndex(state.doc);
                        return { blocks, version: 0 };
                    },

                    apply: (tr, value, _, newState) => {
                        // Only rebuild if document changed
                        if (!tr.docChanged) {
                            return value;
                        }

                        const blocks = buildBlockIndex(newState.doc);
                        extension.storage.blocks = blocks;

                        return {
                            blocks,
                            version: value.version + 1,
                        };
                    },
                },
            }),
        ];
    },
});

/**
 * Get block position by ID from state
 * Returns null if block not found or plugin not initialized
 */
export function getBlockPosition(state: { doc: ProseMirrorNode }, blockId: string): BlockPosition | null {
    // Type guard and null check
    if (!state || !('doc' in state)) return null;

    try {
        const pluginState = BlockIndexPluginKey.getState(state as Parameters<typeof BlockIndexPluginKey.getState>[0]);
        if (!pluginState || !pluginState.blocks) return null;

        return pluginState.blocks.get(blockId) ?? null;
    } catch {
        // Plugin not registered or state invalid
        return null;
    }
}

/**
 * Get all block IDs from the document
 * Returns empty array if plugin not initialized
 */
export function getAllBlockIds(state: { doc: ProseMirrorNode }): string[] {
    if (!state || !('doc' in state)) return [];

    try {
        const pluginState = BlockIndexPluginKey.getState(state as Parameters<typeof BlockIndexPluginKey.getState>[0]);
        if (!pluginState || !pluginState.blocks) return [];

        const entries = Array.from(pluginState.blocks.entries());
        entries.sort((a, b) => a[1].pos - b[1].pos);

        return entries.map(([id]) => id);
    } catch {
        return [];
    }
}

export default BlockIndex;

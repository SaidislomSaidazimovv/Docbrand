/**
 * Linked Block Decorator Plugin
 * 
 * Uses ProseMirror decorations to show visual indicators for blocks
 * linked to RFP requirements. This is persistent unlike DOM manipulation.
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/core';

export const LinkedBlockDecoratorKey = new PluginKey('linkedBlockDecorator');

// Store for linked block IDs - syncs with requirements store
const linkedBlockIds = new Set<string>();

/**
 * Add a block ID to the linked set
 */
export function markBlockAsLinked(blockId: string): void {
    linkedBlockIds.add(blockId);
}

/**
 * Remove a block ID from the linked set
 */
export function unmarkBlockAsLinked(blockId: string): void {
    linkedBlockIds.delete(blockId);
}

/**
 * Check if a block is linked
 */
export function isBlockLinked(blockId: string): boolean {
    return linkedBlockIds.has(blockId);
}

/**
 * Get all linked block IDs
 */
export function getLinkedBlockIds(): string[] {
    return Array.from(linkedBlockIds);
}

/**
 * Clear all linked blocks
 */
export function clearLinkedBlocks(): void {
    linkedBlockIds.clear();
}

export interface LinkedBlockDecoratorOptions {
    linkedClass: string;
    highlightClass: string;
}

export const LinkedBlockDecorator = Extension.create<LinkedBlockDecoratorOptions>({
    name: 'linkedBlockDecorator',

    addOptions() {
        return {
            linkedClass: 'block-linked',
            highlightClass: 'block-highlight',
        };
    },

    addProseMirrorPlugins() {
        const { linkedClass } = this.options;

        return [
            new Plugin({
                key: LinkedBlockDecoratorKey,

                state: {
                    init() {
                        return DecorationSet.empty;
                    },

                    apply(tr, oldSet, oldState, newState) {
                        // Rebuild decorations based on linked blocks
                        const decorations: Decoration[] = [];

                        newState.doc.descendants((node, pos) => {
                            if (node.isBlock && node.type.name === 'paragraph' ||
                                node.type.name === 'heading' ||
                                node.type.name === 'docBlock') {

                                // Check if this block has a linked requirement
                                // Generate a block ID from position/content
                                const textContent = node.textContent.substring(0, 50);
                                const hash = textContent.split('').reduce((a, b) => {
                                    a = ((a << 5) - a) + b.charCodeAt(0);
                                    return a & a;
                                }, 0);
                                const blockId = `block-${Math.abs(hash).toString(16).substring(0, 8)}`;

                                if (linkedBlockIds.has(blockId)) {
                                    // Add decoration for this block
                                    decorations.push(
                                        Decoration.node(pos, pos + node.nodeSize, {
                                            class: linkedClass,
                                            'data-block-id': blockId,
                                            'data-linked': 'true',
                                        })
                                    );
                                }
                            }
                        });

                        return DecorationSet.create(newState.doc, decorations);
                    },
                },

                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },
            }),
        ];
    },
});

export default LinkedBlockDecorator;

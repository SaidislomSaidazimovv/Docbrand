/**
 * DocBlockWrapper Extension
 * 
 * Automatically wraps raw block nodes (paragraph, heading, etc.) in DocBlock wrappers.
 * Uses appendTransaction to enforce the invariant that all content must be in DocBlocks.
 * 
 * This provides a migration path - existing content without DocBlock wrappers
 * will automatically get wrapped on load/edit.
 * 
 * @see DocBrand 001 process/feature-1.1/decision.md
 * 
 * IMPORTANT: This extension is DISABLED by default to avoid infinite loops.
 * Enable it only when you need to migrate existing content.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Transaction } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';

export const DocBlockWrapperKey = new PluginKey('docBlockWrapper');

/**
 * Block types that should be wrapped in DocBlock
 */
const WRAPPABLE_BLOCKS = [
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'taskList',
    'blockquote',
    'codeBlock',
    'table',
];

export interface DocBlockWrapperOptions {
    /** Enable auto-wrapping (default: false to prevent infinite loops) */
    enabled: boolean;
}

export const DocBlockWrapper = Extension.create<DocBlockWrapperOptions>({
    name: 'docBlockWrapper',

    priority: 1000,

    addOptions() {
        return {
            enabled: false, // DISABLED by default for safety
        };
    },

    addProseMirrorPlugins() {
        const extensionOptions = this.options;

        return [
            new Plugin({
                key: DocBlockWrapperKey,

                appendTransaction(transactions: readonly Transaction[], oldState, newState) {
                    // Skip if disabled
                    if (!extensionOptions.enabled) {
                        return null;
                    }

                    // Skip if this is our own transaction (prevent infinite loop!)
                    const isOwn = transactions.some(tr => tr.getMeta(DocBlockWrapperKey));
                    if (isOwn) {
                        return null;
                    }

                    // Only process if document changed
                    const docChanged = transactions.some(tr => tr.docChanged);
                    if (!docChanged) {
                        return null;
                    }

                    const docBlockType = newState.schema.nodes.docBlock;
                    if (!docBlockType) {
                        return null;
                    }

                    // Collect positions that need wrapping (in reverse order!)
                    const toWrap: Array<{ pos: number; node: typeof newState.doc.firstChild }> = [];

                    newState.doc.forEach((node, offset) => {
                        if (WRAPPABLE_BLOCKS.includes(node.type.name)) {
                            toWrap.push({ pos: offset, node });
                        }
                    });

                    if (toWrap.length === 0) {
                        return null;
                    }

                    // Process in REVERSE order to maintain correct positions
                    const { tr } = newState;

                    for (let i = toWrap.length - 1; i >= 0; i--) {
                        const { pos, node } = toWrap[i];
                        if (!node) continue;

                        // Determine block type
                        let blockType = 'paragraph';
                        if (node.type.name === 'heading') {
                            blockType = 'heading';
                        } else if (node.type.name.includes('List')) {
                            blockType = 'list';
                        } else if (node.type.name === 'table') {
                            blockType = 'table';
                        } else if (node.type.name === 'codeBlock') {
                            blockType = 'codeBlock';
                        }

                        // Create wrapper
                        const wrapper = docBlockType.create(
                            {
                                id: `block-${uuidv4().slice(0, 8)}`,
                                blockType,
                                source: 'manual',
                                linkedRequirements: [],
                            },
                            node
                        );

                        tr.replaceWith(pos, pos + node.nodeSize, wrapper);
                    }

                    // Mark as our transaction to prevent infinite loop
                    tr.setMeta(DocBlockWrapperKey, true);
                    tr.setMeta('addToHistory', false);

                    return tr;
                },
            }),
        ];
    },
});

export default DocBlockWrapper;

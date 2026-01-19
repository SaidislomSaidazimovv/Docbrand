/**
 * NodeSelection Extension
 * 
 * Allows selecting entire blocks (paragraphs, headings) as a unit.
 * Based on prosemirror-interaction skill documentation.
 * 
 * Features:
 * - Alt+Click on block to select entire block
 * - Alt+A to select current block
 * - Blue background highlight for selected block
 * - Escape to exit selection
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state';

export interface NodeSelectionOptions {
    /**
     * CSS class for selected node
     */
    selectedClass: string;
}

export const NodeSelectionPluginKey = new PluginKey('nodeSelection');

export const NodeSelectionExtension = Extension.create<NodeSelectionOptions>({
    name: 'nodeSelectionExtension',

    addOptions() {
        return {
            selectedClass: 'node-selected',
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: NodeSelectionPluginKey,

                props: {
                    /**
                     * Handle click on block to select it (with Alt modifier key)
                     */
                    handleClick(view, pos, event) {
                        // Alt+Click selects the entire block
                        if (event.altKey) {
                            const $pos = view.state.doc.resolve(pos);
                            const depth = $pos.depth;

                            if (depth > 0) {
                                const blockStart = $pos.before(depth);
                                const node = view.state.doc.nodeAt(blockStart);

                                if (node && node.isBlock) {
                                    const selection = NodeSelection.create(view.state.doc, blockStart);
                                    view.dispatch(view.state.tr.setSelection(selection));
                                    return true;
                                }
                            }
                        }
                        return false;
                    },
                },
            }),
        ];
    },

    addKeyboardShortcuts() {
        return {
            // Escape clears node selection
            'Escape': () => {
                const { selection } = this.editor.state;
                if (selection instanceof NodeSelection) {
                    // Move cursor to end of selected node
                    const pos = selection.$anchor.end();
                    this.editor.commands.setTextSelection(pos);
                    return true;
                }
                return false;
            },

            // Alt+A selects current block
            'Alt-a': () => {
                const { state } = this.editor;
                const { $from } = state.selection;

                if ($from.depth > 0) {
                    const blockStart = $from.before($from.depth);
                    const node = state.doc.nodeAt(blockStart);

                    if (node && node.isBlock) {
                        const selection = NodeSelection.create(state.doc, blockStart);
                        this.editor.view.dispatch(state.tr.setSelection(selection));
                        return true;
                    }
                }
                return false;
            },
        };
    },
});

export default NodeSelectionExtension;

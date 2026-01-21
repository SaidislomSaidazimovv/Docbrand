/**
 * EditorController - Module Singleton
 * 
 * Holds editor reference and provides centralized control.
 * Used by external systems (sidebars, modals) to interact with editor.
 * 
 * @see DocBrand 001 process/feature-1.2/decision.md
 */

import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { linkIndex } from './LinkIndex';
import { BlockIndexPluginKey } from './plugins/BlockIndexPlugin';
import type { LinkedRequirement } from './extensions/DocBlock';

// =============================================================================
// TYPES
// =============================================================================

interface BlockSearchResult {
    pos: number;
    attrs: Record<string, unknown>;
}

// =============================================================================
// CONTROLLER CLASS
// =============================================================================

class EditorControllerClass {
    private editor: Editor | null = null;

    /**
     * Set the editor instance
     */
    setEditor(editor: Editor): void {
        this.editor = editor;
    }

    /**
     * Get the current editor instance
     */
    getEditor(): Editor | null {
        return this.editor;
    }

    /**
     * Check if editor is available
     */
    isReady(): boolean {
        return this.editor !== null && !this.editor.isDestroyed;
    }

    /**
     * Clear editor reference (on unmount)
     */
    clearEditor(): void {
        this.editor = null;
    }

    /**
     * Force editor to re-render by dispatching empty transaction
     * Also clears any stale DOM visual indicators
     */
    forceRefresh(): void {
        if (!this.isReady()) return;

        // Clear any stale linked block indicators from DOM
        const linkedElements = document.querySelectorAll('.block-linked, [data-linked="true"]');
        linkedElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.borderLeft = '';
            htmlEl.style.paddingLeft = '';
            htmlEl.style.marginLeft = '';
            htmlEl.classList.remove('block-linked');
            htmlEl.removeAttribute('data-linked');
            htmlEl.removeAttribute('data-block-id');
        });

        // Dispatch empty transaction to trigger re-render
        const { state, view } = this.editor!;
        view.dispatch(state.tr);
        console.log('[EditorController] Forced refresh');
    }

    /**
     * Find a block by ID
     */
    private findBlock(blockId: string): BlockSearchResult | null {
        if (!this.isReady()) return null;

        const state = this.editor!.state;
        let result: BlockSearchResult | null = null;

        state.doc.descendants((node, pos) => {
            if (node.type.name === 'docBlock' && node.attrs.id === blockId) {
                result = { pos, attrs: node.attrs as Record<string, unknown> };
                return false;
            }
            return true;
        });

        return result;
    }

    // ==========================================================================
    // BLOCK OPERATIONS
    // ==========================================================================

    /**
     * Scroll to a specific block
     */
    scrollToBlock(blockId: string): boolean {
        if (!this.isReady()) return false;

        const state = this.editor!.state;
        const pluginState = BlockIndexPluginKey.getState(state);
        const blockPos = pluginState?.blocks.get(blockId);

        if (!blockPos) {
            console.warn(`[EditorController] Block not found: ${blockId}`);
            return false;
        }

        const { tr } = state;
        const resolvedPos = state.doc.resolve(blockPos.pos + 1);
        tr.setSelection(TextSelection.near(resolvedPos));
        tr.scrollIntoView();

        this.editor!.view.dispatch(tr);
        return true;
    }

    /**
     * Select a block (put cursor at start)
     */
    selectBlock(blockId: string): boolean {
        if (!this.isReady()) return false;

        const state = this.editor!.state;
        const pluginState = BlockIndexPluginKey.getState(state);
        const blockPos = pluginState?.blocks.get(blockId);

        if (!blockPos) {
            console.warn(`[EditorController] Block not found: ${blockId}`);
            return false;
        }

        const { tr } = state;
        const contentStart = blockPos.pos + 1;
        tr.setSelection(TextSelection.near(state.doc.resolve(contentStart)));

        this.editor!.view.dispatch(tr);
        this.editor!.view.focus();

        return true;
    }

    /**
     * Get block at current cursor position
     */
    getCurrentBlockId(): string | null {
        if (!this.isReady()) return null;

        const { state } = this.editor!;
        const { $from } = state.selection;

        for (let d = $from.depth; d >= 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'docBlock' && node.attrs.id) {
                return node.attrs.id as string;
            }
        }

        return null;
    }

    // ==========================================================================
    // REQUIREMENT LINKING
    // ==========================================================================

    /**
     * Add requirement link to current block
     */
    linkRequirementToCurrentBlock(reqId: string): boolean {
        const blockId = this.getCurrentBlockId();
        if (!blockId) {
            console.warn('[EditorController] No block selected');
            return false;
        }

        return this.linkRequirementToBlock(blockId, reqId);
    }

    /**
     * Add requirement link to specific block
     */
    linkRequirementToBlock(blockId: string, reqId: string): boolean {
        if (!this.isReady()) return false;

        const block = this.findBlock(blockId);
        if (!block) {
            console.warn(`[EditorController] Block not found: ${blockId}`);
            return false;
        }

        const currentLinks = (block.attrs.linkedRequirements || []) as LinkedRequirement[];

        // Check if already linked
        if (currentLinks.some((lr) => lr.reqId === reqId)) {
            return false;
        }

        // Add link
        const updated: LinkedRequirement[] = [
            ...currentLinks,
            {
                reqId,
                coverage: 'full',
                confidence: 1.0,
                timestamp: Date.now(),
            },
        ];

        const state = this.editor!.state;
        const { tr } = state;

        tr.setNodeMarkup(block.pos, null, {
            ...block.attrs,
            linkedRequirements: updated,
        });

        this.editor!.view.dispatch(tr);

        // Update LinkIndex
        linkIndex.applyTransactionUpdate({
            blockId,
            addedLinks: [{ reqId, coverage: 'full' }],
            removedLinks: [],
        });

        return true;
    }

    /**
     * Remove requirement link from block
     */
    unlinkRequirementFromBlock(blockId: string, reqId: string): boolean {
        if (!this.isReady()) return false;

        const block = this.findBlock(blockId);
        if (!block) {
            console.warn(`[EditorController] Block not found: ${blockId}`);
            return false;
        }

        const currentLinks = (block.attrs.linkedRequirements || []) as LinkedRequirement[];
        const updated = currentLinks.filter((lr) => lr.reqId !== reqId);

        const state = this.editor!.state;
        const { tr } = state;

        tr.setNodeMarkup(block.pos, null, {
            ...block.attrs,
            linkedRequirements: updated,
        });

        this.editor!.view.dispatch(tr);

        // Update LinkIndex
        linkIndex.applyTransactionUpdate({
            blockId,
            addedLinks: [],
            removedLinks: [reqId],
        });

        return true;
    }

    /**
     * Check if requirement is linked to any block
     */
    isRequirementLinked(reqId: string): boolean {
        return linkIndex.isRequirementLinked(reqId);
    }

    /**
     * Get all blocks linked to a requirement
     */
    getBlocksForRequirement(reqId: string): string[] {
        return linkIndex.getBlocksForRequirement(reqId);
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const EditorController = new EditorControllerClass();

export default EditorController;

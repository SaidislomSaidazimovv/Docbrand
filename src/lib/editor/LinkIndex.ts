/**
 * LinkIndex - In-Memory Cache for Requirement Links
 * 
 * This is a READ-ONLY derived cache from document state.
 * The document (DocBlock.attrs.linkedRequirements) is CANONICAL.
 * 
 * @see DocBrand 001 process/part-2.2/path-e-architecture.md
 * 
 * Key Invariants:
 * - Can be rebuilt at any time from editor.getJSON()
 * - Never write to this without corresponding document transaction
 * - Used for O(1) lookups in sidebar/gutter without doc traversal
 */

import { EventEmitter } from 'events';
import type { JSONContent } from '@tiptap/core';
import type { LinkedRequirement } from './extensions/DocBlock';

// =============================================================================
// TYPES
// =============================================================================

export interface LinkTransactionMeta {
    blockId: string;
    addedLinks: { reqId: string; coverage: 'full' | 'partial' }[];
    removedLinks: string[];
}

export interface BlockLinkInfo {
    blockId: string;
    linkedRequirements: LinkedRequirement[];
}

// =============================================================================
// LINK INDEX CLASS
// =============================================================================

export class LinkIndex extends EventEmitter {
    // reqId → Set<blockId> - which blocks link to this requirement
    private reqToBlocks = new Map<string, Set<string>>();

    // blockId → LinkedRequirement[] - which requirements are linked to this block
    private blockToReqs = new Map<string, LinkedRequirement[]>();

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Rebuild entire index from document.
     * Called on: document load, sanity checks, recovery
     */
    rebuildFromDocument(doc: JSONContent): void {
        this.clear();
        this.traverseAndIndex(doc);
        this.emit('index:rebuilt');
    }

    /**
     * Incremental update from transaction.
     * This is an OPTIMIZATION - if this ever drifts, rebuildFromDocument corrects it.
     */
    applyTransactionUpdate(meta: LinkTransactionMeta): void {
        const { blockId, addedLinks, removedLinks } = meta;

        // Handle removed links
        for (const reqId of removedLinks) {
            this.removeLink(blockId, reqId);
        }

        // Handle added links
        for (const { reqId, coverage } of addedLinks) {
            this.addLink(blockId, reqId, coverage);
        }

        this.emit('index:updated', { blockId, addedLinks, removedLinks });
    }

    /**
     * Get all blocks linked to a requirement
     */
    getBlocksForRequirement(reqId: string): string[] {
        const blocks = this.reqToBlocks.get(reqId);
        return blocks ? Array.from(blocks) : [];
    }

    /**
     * Get all requirements linked to a block
     */
    getRequirementsForBlock(blockId: string): LinkedRequirement[] {
        return this.blockToReqs.get(blockId) || [];
    }

    /**
     * Check if a requirement is linked to any block
     */
    isRequirementLinked(reqId: string): boolean {
        const blocks = this.reqToBlocks.get(reqId);
        return blocks !== undefined && blocks.size > 0;
    }

    /**
     * Check if a block has any linked requirements
     */
    hasLinks(blockId: string): boolean {
        const reqs = this.blockToReqs.get(blockId);
        return reqs !== undefined && reqs.length > 0;
    }

    /**
     * Get count of linked requirements for a block
     */
    getLinkCount(blockId: string): number {
        return this.blockToReqs.get(blockId)?.length || 0;
    }

    /**
     * Get total count of all links in the document
     */
    getTotalLinkCount(): number {
        let count = 0;
        for (const reqs of this.blockToReqs.values()) {
            count += reqs.length;
        }
        return count;
    }

    /**
     * Sanity check: compare index to document traversal.
     * Used in dev mode and pre-save checks.
     */
    verifySyncWithDocument(doc: JSONContent): boolean {
        const freshIndex = new LinkIndex();
        freshIndex.rebuildFromDocument(doc);

        // Compare sizes
        if (this.blockToReqs.size !== freshIndex.blockToReqs.size) {
            console.warn('[LinkIndex] Block count mismatch');
            return false;
        }

        // Compare content
        for (const [blockId, reqs] of this.blockToReqs) {
            const freshReqs = freshIndex.blockToReqs.get(blockId);
            if (!freshReqs) {
                console.warn(`[LinkIndex] Missing block: ${blockId}`);
                return false;
            }
            if (reqs.length !== freshReqs.length) {
                console.warn(`[LinkIndex] Link count mismatch for block: ${blockId}`);
                return false;
            }
        }

        return true;
    }

    // ==========================================================================
    // PRIVATE METHODS
    // ==========================================================================

    private clear(): void {
        this.reqToBlocks.clear();
        this.blockToReqs.clear();
    }

    private traverseAndIndex(node: JSONContent): void {
        if (!node) return;

        // Check if this is a docBlock with links
        if (node.type === 'docBlock' && node.attrs?.id) {
            const blockId = node.attrs.id as string;
            const linkedRequirements = (node.attrs.linkedRequirements || []) as LinkedRequirement[];

            if (linkedRequirements.length > 0) {
                this.blockToReqs.set(blockId, linkedRequirements);

                for (const lr of linkedRequirements) {
                    if (!this.reqToBlocks.has(lr.reqId)) {
                        this.reqToBlocks.set(lr.reqId, new Set());
                    }
                    this.reqToBlocks.get(lr.reqId)!.add(blockId);
                }
            }
        }

        // Recurse into children
        if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) {
                this.traverseAndIndex(child);
            }
        }
    }

    private addLink(blockId: string, reqId: string, coverage: 'full' | 'partial'): void {
        // Update blockToReqs
        if (!this.blockToReqs.has(blockId)) {
            this.blockToReqs.set(blockId, []);
        }
        const reqs = this.blockToReqs.get(blockId)!;
        if (!reqs.some((r) => r.reqId === reqId)) {
            reqs.push({
                reqId,
                coverage,
                confidence: 1.0,
                timestamp: Date.now(),
            });
        }

        // Update reqToBlocks
        if (!this.reqToBlocks.has(reqId)) {
            this.reqToBlocks.set(reqId, new Set());
        }
        this.reqToBlocks.get(reqId)!.add(blockId);
    }

    private removeLink(blockId: string, reqId: string): void {
        // Update blockToReqs
        const reqs = this.blockToReqs.get(blockId);
        if (reqs) {
            const filtered = reqs.filter((r) => r.reqId !== reqId);
            if (filtered.length > 0) {
                this.blockToReqs.set(blockId, filtered);
            } else {
                this.blockToReqs.delete(blockId);
            }
        }

        // Update reqToBlocks
        const blocks = this.reqToBlocks.get(reqId);
        if (blocks) {
            blocks.delete(blockId);
            if (blocks.size === 0) {
                this.reqToBlocks.delete(reqId);
            }
        }
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const linkIndex = new LinkIndex();

export default LinkIndex;

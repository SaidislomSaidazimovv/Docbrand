/**
 * DocBlock Node Extension
 * 
 * Wrapper node for all content blocks in the document.
 * Carries block identity and metadata per Feature 1.1 decision.
 * 
 * @see DocBrand 001 process/feature-1.1/decision.md
 * @see DocBrand 001 process/part-2.2/path-e-architecture.md
 * 
 * Key Invariants:
 * - Every block has unique stable ID
 * - linkedRequirements is CANONICAL (source of truth)
 * - Undo/redo works automatically (attrs in history)
 * - Copy/paste preserves links (attrs travel with slice)
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface LinkedRequirement {
    reqId: string;
    coverage: 'full' | 'partial';
    confidence: number;
    timestamp: number;
}

export interface DocBlockAttributes {
    id: string;
    blockType: 'paragraph' | 'heading' | 'list' | 'table' | 'codeBlock';
    source: 'manual' | 'import' | 'paste';
    linkedRequirements: LinkedRequirement[];
}

// =============================================================================
// DOCBLOCK NODE
// =============================================================================

export const DocBlock = Node.create<{
    HTMLAttributes: Record<string, string>;
}>({
    name: 'docBlock',

    group: 'block',

    // Each docBlock contains exactly one "real" block content
    content: 'block',

    // Block-level node
    defining: true,

    // Can be dragged
    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            // Unique stable ID - required
            id: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-block-id') || uuidv4(),
                renderHTML: (attributes) => ({
                    'data-block-id': attributes.id,
                }),
            },

            // Block content type - for quick filtering
            blockType: {
                default: 'paragraph',
                parseHTML: (element) => element.getAttribute('data-block-type') || 'paragraph',
                renderHTML: (attributes) => ({
                    'data-block-type': attributes.blockType,
                }),
            },

            // Source of the block - manual typing, import, or paste
            source: {
                default: 'manual',
                parseHTML: (element) => element.getAttribute('data-source') || 'manual',
                renderHTML: (attributes) => ({
                    'data-source': attributes.source,
                }),
            },

            // CANONICAL: Linked requirements (Path E architecture)
            // This is the source of truth - LinkIndex is derived from this
            linkedRequirements: {
                default: [],
                parseHTML: (element) => {
                    const attr = element.getAttribute('data-linked-requirements');
                    if (!attr) return [];
                    try {
                        return JSON.parse(attr);
                    } catch {
                        return [];
                    }
                },
                renderHTML: (attributes) => {
                    if (!attributes.linkedRequirements || attributes.linkedRequirements.length === 0) {
                        return {};
                    }
                    return {
                        'data-linked-requirements': JSON.stringify(attributes.linkedRequirements),
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-block-id]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        // Determine CSS class based on linked requirements
        const hasLinks = node.attrs.linkedRequirements?.length > 0;
        const linkClass = hasLinks ? 'has-links' : 'no-links';

        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                class: `doc-block ${linkClass}`,
                'data-drag-handle': '',
            }),
            0, // Content hole
        ];
    },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a new unique block ID
 */
export function generateBlockId(): string {
    return `block-${uuidv4().slice(0, 8)}`;
}

/**
 * Create a new linked requirement entry
 */
export function createLinkedRequirement(
    reqId: string,
    coverage: 'full' | 'partial' = 'full'
): LinkedRequirement {
    return {
        reqId,
        coverage,
        confidence: 1.0,
        timestamp: Date.now(),
    };
}

/**
 * Find if a requirement is already linked to a block
 */
export function isRequirementLinked(
    linkedRequirements: LinkedRequirement[],
    reqId: string
): boolean {
    return linkedRequirements.some((lr) => lr.reqId === reqId);
}

/**
 * Add a requirement link to the list (returns new array)
 */
export function addRequirementLink(
    linkedRequirements: LinkedRequirement[],
    reqId: string,
    coverage: 'full' | 'partial' = 'full'
): LinkedRequirement[] {
    if (isRequirementLinked(linkedRequirements, reqId)) {
        return linkedRequirements; // Already linked
    }
    return [...linkedRequirements, createLinkedRequirement(reqId, coverage)];
}

/**
 * Remove a requirement link from the list (returns new array)
 */
export function removeRequirementLink(
    linkedRequirements: LinkedRequirement[],
    reqId: string
): LinkedRequirement[] {
    return linkedRequirements.filter((lr) => lr.reqId !== reqId);
}

export default DocBlock;

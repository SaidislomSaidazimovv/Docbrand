/**
 * StrictDocument Extension
 * 
 * Enforces Invariant A: Doc can only contain DocBlocks at top level.
 * No paragraphs/headings/lists directly under doc.
 * 
 * @see DocBrand 001 process/feature-1.1/decision.md
 */

import { Node } from '@tiptap/core';

export const StrictDocument = Node.create({
    name: 'doc',

    // This is the root node
    topNode: true,

    // INVARIANT A: Only docBlock wrappers at top level
    // This prevents raw paragraph/heading nodes from being direct children
    content: 'docBlock+',
});

export default StrictDocument;

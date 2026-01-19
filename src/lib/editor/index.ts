/**
 * Editor Module Index
 * 
 * Central exports for the DocBrand editor system.
 */

// Extensions
export { DocBlock, generateBlockId, type LinkedRequirement, type DocBlockAttributes } from './extensions/DocBlock';
export { StrictDocument } from './extensions/StrictDocument';
export { RequirementLinking, RequirementLinkingKey } from './extensions/RequirementLinking';
export { DocBlockWrapper } from './extensions/DocBlockWrapper';

// Plugins
export { BlockIndex, BlockIndexPluginKey, getBlockPosition, getAllBlockIds } from './plugins/BlockIndexPlugin';

// Core
export { LinkIndex, linkIndex, type LinkTransactionMeta } from './LinkIndex';
export { EditorController } from './EditorController';

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
export { NodeSelectionExtension, NodeSelectionPluginKey } from './extensions/NodeSelectionExtension';

// Plugins
export { BlockIndex, BlockIndexPluginKey, getBlockPosition, getAllBlockIds } from './plugins/BlockIndexPlugin';
export { LinkedBlockDecorator, LinkedBlockDecoratorKey, markBlockAsLinked, unmarkBlockAsLinked, isBlockLinked, getLinkedBlockIds } from './plugins/LinkedBlockDecorator';

// Core
export { LinkIndex, linkIndex, type LinkTransactionMeta } from './LinkIndex';
export { EditorController } from './EditorController';

// Smart Chips
export { SMART_CHIPS, resolveVariables, hasVariables, findVariables, type SmartChipVariable, type VariableContext } from './SmartChipVariables';


/**
 * Editor Plugins Index
 * 
 * Export all plugins from lib/editor/plugins/
 * as documented in docs/Skills/phase-3-4-architecture/SKILL.md
 */

export { QualityScannerPlugin, qualityKey } from './QualityScannerPlugin';
export type { QualityIssue, QualityState, Severity } from './QualityScannerPlugin';

export { PasteFirewallPlugin, pasteFirewallKey } from './PasteFirewallPlugin';
export type { PasteFirewallState } from './PasteFirewallPlugin';

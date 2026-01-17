/**
 * Quality Scanner TipTap Extension
 * 
 * Wraps the QualityScannerPlugin for use with TipTap
 * 
 * @see docs/Skills/phase-3-4-architecture/SKILL.md
 */

import { Extension } from '@tiptap/core';
import { QualityScannerPlugin } from './QualityScannerPlugin';

export const QualityScanner = Extension.create({
    name: 'qualityScanner',

    addProseMirrorPlugins() {
        return [QualityScannerPlugin];
    },
});

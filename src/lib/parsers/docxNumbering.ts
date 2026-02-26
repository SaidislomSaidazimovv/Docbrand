/**
 * DOCX Numbering Parser
 *
 * Parses word/numbering.xml to determine list types (bullet vs ordered)
 * for each numId. Follows the numId → abstractNumId → numFmt chain.
 *
 * Server-only — used by docxToTiptap.ts
 */

import type JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

type XmlObj = Record<string, unknown>;

function attr(obj: unknown, attrName: string): string | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    return (obj as XmlObj)[attrName] as string | undefined;
}

function child(obj: unknown, key: string): XmlObj | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const val = (obj as XmlObj)[key];
    if (!val) return undefined;
    if (Array.isArray(val)) return val[0] as XmlObj;
    return val as XmlObj;
}

function children(obj: unknown, key: string): XmlObj[] {
    if (!obj || typeof obj !== 'object') return [];
    const val = (obj as XmlObj)[key];
    if (!val) return [];
    if (Array.isArray(val)) return val as XmlObj[];
    return [val as XmlObj];
}

/**
 * Parse numbering.xml and return a Map of numId → list type.
 * Never throws — returns empty map on failure.
 */
export async function resolveNumbering(zip: JSZip): Promise<Map<string, 'bullet' | 'ordered'>> {
    const result = new Map<string, 'bullet' | 'ordered'>();

    try {
        const numFile = zip.file('word/numbering.xml');
        if (!numFile) return result;

        const numXml = await numFile.async('text');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            removeNSPrefix: false,
        });

        const parsed = parser.parse(numXml);
        const root = parsed['w:numbering'];
        if (!root) return result;

        // 1. Build abstractNumId → numFmt map (from first level w:lvl ilvl="0")
        const abstractNums = children(root, 'w:abstractNum');
        const abstractMap = new Map<string, 'bullet' | 'ordered'>();

        for (const abstractNum of abstractNums) {
            const abstractNumId = attr(abstractNum, 'w:abstractNumId');
            if (!abstractNumId) continue;

            // Find level 0 (top-level list format)
            const levels = children(abstractNum, 'w:lvl');
            let fmt: string | undefined;

            for (const lvl of levels) {
                const ilvl = attr(lvl, 'w:ilvl');
                if (ilvl === '0' || ilvl === undefined) {
                    const numFmt = child(lvl, 'w:numFmt');
                    fmt = numFmt ? attr(numFmt, 'w:val') : undefined;
                    break;
                }
            }

            // Determine list type from numFmt
            // decimal, lowerLetter, upperLetter, lowerRoman, upperRoman = ordered
            // bullet, none, or anything else = bullet
            const orderedFormats = ['decimal', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman',
                'decimalZero', 'ordinal', 'ordinalText', 'cardinalText'];
            const listType = fmt && orderedFormats.includes(fmt) ? 'ordered' : 'bullet';
            abstractMap.set(abstractNumId, listType);
        }

        // 2. Build numId → abstractNumId → listType
        const nums = children(root, 'w:num');
        for (const num of nums) {
            const numId = attr(num, 'w:numId');
            if (!numId) continue;

            const abstractNumIdRef = child(num, 'w:abstractNumId');
            const abstractNumId = abstractNumIdRef ? attr(abstractNumIdRef, 'w:val') : undefined;

            if (abstractNumId && abstractMap.has(abstractNumId)) {
                result.set(numId, abstractMap.get(abstractNumId)!);
            } else {
                // Default to bullet if we can't resolve
                result.set(numId, 'bullet');
            }
        }
    } catch (err) {
        console.error('[docxNumbering] Failed:', err);
    }

    return result;
}

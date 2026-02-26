/**
 * DOCX Relationships Parser
 *
 * Parses word/_rels/document.xml.rels to resolve rId references
 * (hyperlinks, images, etc.) to their target URLs.
 *
 * Server-only — used by docxToTiptap.ts
 */

import type JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

/**
 * Parse document.xml.rels and return a Map of rId → target URL.
 * Only includes external hyperlink relationships.
 * Never throws — returns empty map on failure.
 */
export async function resolveRelationships(zip: JSZip): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    try {
        const relsFile = zip.file('word/_rels/document.xml.rels');
        if (!relsFile) return result;

        const relsXml = await relsFile.async('text');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            removeNSPrefix: false,
        });

        const parsed = parser.parse(relsXml);
        const root = parsed['Relationships'];
        if (!root) return result;

        const rels = root['Relationship'];
        if (!rels) return result;

        const relList = Array.isArray(rels) ? rels : [rels];

        for (const rel of relList) {
            if (!rel || typeof rel !== 'object') continue;
            const id = rel['Id'] as string | undefined;
            const target = rel['Target'] as string | undefined;
            const targetMode = rel['TargetMode'] as string | undefined;

            // Only include external hyperlinks (TargetMode="External")
            if (id && target && targetMode === 'External') {
                result.set(id, target);
            }
        }
    } catch (err) {
        console.error('[docxRelationships] Failed:', err);
    }

    return result;
}

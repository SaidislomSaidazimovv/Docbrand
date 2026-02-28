/**
 * Apply a normalized import payload to DocBrand stores.
 *
 * Shared by:
 * - JSON import (client-side deterministic + AI brand detection)
 * - PDF/DOCX/XLSX import (server-parsed via /api/import/parse)
 *
 * Client-side safe — no secrets, no server dependencies.
 */

import { useStyleStore } from '@/store/styleStore';
import { useEditorStore } from '@/store/editorStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';
import type { Requirement } from '@/types';
import type { NormalizedImportPayload, ImportApplyResult } from './types';

/**
 * Coerce whatever the server returned for "document" into a valid
 * TipTap { type: "doc", content: [...] } shape — or null.
 */
function coerceToDoc(raw: unknown): { type: 'doc'; content: unknown[] } | null {
    if (!raw) return null;

    // Already a proper doc node
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;

        // { type: "doc", content: [...] }
        if (obj.type === 'doc' && Array.isArray(obj.content) && obj.content.length > 0) {
            return { type: 'doc', content: obj.content };
        }

        // AI sometimes omits the "type":"doc" wrapper and returns just { content: [...] }
        if (Array.isArray(obj.content) && obj.content.length > 0) {
            return { type: 'doc', content: obj.content };
        }
    }

    // AI returned a bare content array (no wrapper object)
    if (Array.isArray(raw) && raw.length > 0) {
        return { type: 'doc', content: raw };
    }

    // Plain string — wrap into a single paragraph
    if (typeof raw === 'string' && raw.trim().length > 0) {
        const paragraphs = raw.split(/\n\s*\n/).filter(p => p.trim());
        return {
            type: 'doc',
            content: paragraphs.map(p => ({
                type: 'paragraph',
                content: [{ type: 'text', text: p.trim() }],
            })),
        };
    }

    return null;
}

export function applyNormalizedImport(
    payload: NormalizedImportPayload,
    fileInfo: { filename: string; fileSize: number }
): ImportApplyResult {
    const result: ImportApplyResult = {
        brandFields: [],
        documentLoaded: false,
        requirementsCount: 0,
    };

    // -----------------------------------------------------------------
    // 1. Brand styles → styleStore
    // -----------------------------------------------------------------
    const brand = payload.brand;
    if (brand) {
        const store = useStyleStore.getState();
        if (brand.fontFamily) { store.setFontFamily(brand.fontFamily); result.brandFields.push(`Font: ${brand.fontFamily}`); }
        if (brand.fontSize !== null) { store.setFontSize(brand.fontSize); result.brandFields.push(`Size: ${brand.fontSize}px`); }
        if (brand.lineHeight !== null) { store.setLineHeight(brand.lineHeight); result.brandFields.push(`Line height: ${brand.lineHeight}`); }
        if (brand.spaceBefore !== null) { store.setSpaceBefore(brand.spaceBefore); result.brandFields.push(`Space before: ${brand.spaceBefore}`); }
        if (brand.spaceAfter !== null) { store.setSpaceAfter(brand.spaceAfter); result.brandFields.push(`Space after: ${brand.spaceAfter}`); }
        if (brand.h1FontSize !== null) { store.setH1FontSize(brand.h1FontSize); result.brandFields.push(`H1 size: ${brand.h1FontSize}px`); }
        if (brand.h2FontSize !== null) { store.setH2FontSize(brand.h2FontSize); result.brandFields.push(`H2 size: ${brand.h2FontSize}px`); }
        if (brand.h1Color) { store.setH1Color(brand.h1Color); result.brandFields.push(`H1 color: ${brand.h1Color}`); }
        if (brand.h2Color) { store.setH2Color(brand.h2Color); result.brandFields.push(`H2 color: ${brand.h2Color}`); }
        if (brand.bodyColor) { store.setBodyColor(brand.bodyColor); result.brandFields.push(`Body color: ${brand.bodyColor}`); }
        if (brand.h1SpaceBefore !== null) { store.setH1SpaceBefore(brand.h1SpaceBefore); result.brandFields.push(`H1 space before: ${brand.h1SpaceBefore}pt`); }
        if (brand.h1SpaceAfter !== null) { store.setH1SpaceAfter(brand.h1SpaceAfter); result.brandFields.push(`H1 space after: ${brand.h1SpaceAfter}pt`); }
        if (brand.h2SpaceBefore !== null) { store.setH2SpaceBefore(brand.h2SpaceBefore); result.brandFields.push(`H2 space before: ${brand.h2SpaceBefore}pt`); }
        if (brand.h2SpaceAfter !== null) { store.setH2SpaceAfter(brand.h2SpaceAfter); result.brandFields.push(`H2 space after: ${brand.h2SpaceAfter}pt`); }
        if (brand.h3Color) { store.setH3Color(brand.h3Color); result.brandFields.push(`H3 color: ${brand.h3Color}`); }
        if (brand.h3FontSize !== null) { store.setH3FontSize(brand.h3FontSize); result.brandFields.push(`H3 size: ${brand.h3FontSize}px`); }
        if (brand.h3SpaceBefore !== null) { store.setH3SpaceBefore(brand.h3SpaceBefore); result.brandFields.push(`H3 space before: ${brand.h3SpaceBefore}pt`); }
        if (brand.h3SpaceAfter !== null) { store.setH3SpaceAfter(brand.h3SpaceAfter); result.brandFields.push(`H3 space after: ${brand.h3SpaceAfter}pt`); }
    }

    // -----------------------------------------------------------------
    // 1b. Page margins + page size → styleStore
    // -----------------------------------------------------------------
    if (payload.margins) {
        const m = payload.margins;
        // margins are in pt (from twipsToPt). Convert pt → px: 1pt = 96/72 px
        const store = useStyleStore.getState();
        store.setMargins({
            top: Math.round(m.top * 96 / 72),
            bottom: Math.round(m.bottom * 96 / 72),
            left: Math.round(m.left * 96 / 72),
            right: Math.round(m.right * 96 / 72),
        });
        result.brandFields.push(`Margins: ${m.top}pt / ${m.bottom}pt / ${m.left}pt / ${m.right}pt`);
    }

    if (payload.pageSize) {
        const ps = payload.pageSize;
        // pageSize is in pt. Convert pt → px: 1pt = 96/72 px
        const store = useStyleStore.getState();
        store.setPageSize({
            width: Math.round(ps.width * 96 / 72),
            height: Math.round(ps.height * 96 / 72),
        });
        result.brandFields.push(`Page: ${ps.width}pt × ${ps.height}pt ${ps.orientation}`);
    }

    // -----------------------------------------------------------------
    // 2. Document content → TipTap editor
    // -----------------------------------------------------------------
    const doc = coerceToDoc(payload.document);

    if (doc) {
        const editor = useEditorStore.getState().editor;
        if (editor) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.commands.setContent(doc as any);
            result.documentLoaded = true;
        } else {
            // Editor not ready yet — retry once after a short delay
            setTimeout(() => {
                const retryEditor = useEditorStore.getState().editor;
                if (retryEditor) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    retryEditor.commands.setContent(doc as any);
                }
            }, 500);
            // Mark as loaded optimistically since content will arrive
            result.documentLoaded = true;
        }
    }

    // -----------------------------------------------------------------
    // 3. Requirements → RFP store
    // -----------------------------------------------------------------
    if (payload.requirements && payload.requirements.length > 0) {
        const now = Date.now();
        const fileId = `import-${fileInfo.filename}-${now}`;

        const reqs: Requirement[] = payload.requirements.map((raw, i) => ({
            id: `req-${now}-${i}`,
            text: raw.text.length > 50 ? raw.text.slice(0, 50) + '...' : raw.text,
            originalText: raw.text,
            sectionPath: raw.section ? [raw.section] : ['Uncategorized'],
            status: 'unlinked' as const,
            kanbanStatus: 'to_address' as const,
            priority: raw.priority === 'mandatory' ? 'mandatory' as const : 'desired' as const,
            linkedBlockIds: [],
            source: { fileId, filename: fileInfo.filename },
            importedAt: now,
        }));

        useSourcesStore.getState().addSource({
            id: fileId,
            filename: fileInfo.filename,
            fileSize: fileInfo.fileSize,
            importedAt: now,
            requirementCount: reqs.length,
        });

        useRequirementsStore.getState().importRequirements(reqs);
        result.requirementsCount = reqs.length;
    }

    return result;
}

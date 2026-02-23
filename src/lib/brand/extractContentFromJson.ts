/**
 * Extract TipTap document content and requirements from a company JSON.
 *
 * Supports three content shapes (checked in priority order):
 *
 * 1. Native TipTap doc JSON — root or nested key is { type:"doc", content:[...] }
 *    Keys checked: document, doc, content, prosemirror, tiptap, editorContent
 *    Also checks if root itself is a doc node.
 *
 * 2. Sections array — an array of { title, body|text|content } objects
 *    Keys checked: sections, chapters, parts
 *    Mapped to heading + paragraph nodes.
 *
 * 3. Requirements array — extracted separately for the RFP store.
 *    Keys checked: requirements, rfpRequirements, items, compliance, checklist
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** TipTap-compatible JSON document (minimal shape) */
export interface TipTapDoc {
    type: 'doc';
    content: TipTapNode[];
}

interface TipTapNode {
    type: string;
    attrs?: Record<string, unknown>;
    content?: TipTapNode[];
    text?: string;
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/** A raw requirement found in the JSON */
export interface RawRequirement {
    id?: string;
    text: string;
    section?: string;
    priority?: string;
}

export interface JsonContentResult {
    /** TipTap doc JSON ready for editor.commands.setContent() */
    doc: TipTapDoc | null;
    /** Requirements found in the JSON (may be empty) */
    requirements: RawRequirement[];
}

// ---------------------------------------------------------------------------
// Doc detection
// ---------------------------------------------------------------------------

const DOC_KEYS = ['document', 'doc', 'content', 'prosemirror', 'tiptap', 'editorContent'];

function isTipTapDoc(value: unknown): value is TipTapDoc {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return obj.type === 'doc' && Array.isArray(obj.content);
}

function findDocNode(parsed: Record<string, unknown>): TipTapDoc | null {
    // Priority 1: root itself is a doc
    if (isTipTapDoc(parsed)) return parsed;

    // Priority 2: well-known keys
    for (const key of DOC_KEYS) {
        const val = parsed[key];
        if (isTipTapDoc(val)) return val;
        // One level deeper (e.g. { document: { doc: { type:"doc", ... } } })
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const inner = val as Record<string, unknown>;
            if (isTipTapDoc(inner)) return inner;
            for (const innerKey of DOC_KEYS) {
                if (isTipTapDoc(inner[innerKey])) return inner[innerKey] as TipTapDoc;
            }
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Sections mapper (fallback)
// ---------------------------------------------------------------------------

const SECTION_KEYS = ['sections', 'chapters', 'parts'];

interface RawSection {
    title?: string;
    heading?: string;
    name?: string;
    body?: string;
    text?: string;
    content?: string;
    paragraphs?: string[];
}

function findSections(parsed: Record<string, unknown>): RawSection[] | null {
    for (const key of SECTION_KEYS) {
        const val = parsed[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
            return val as RawSection[];
        }
    }
    return null;
}

function sectionsToDoc(sections: RawSection[]): TipTapDoc {
    const content: TipTapNode[] = [];

    for (const section of sections) {
        const title = section.title || section.heading || section.name;
        if (title && typeof title === 'string') {
            content.push({
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: title }],
            });
        }

        // Body text
        const bodyText = section.body || section.text || section.content;
        if (typeof bodyText === 'string' && bodyText.trim()) {
            // Split by double newlines into paragraphs
            const paragraphs = bodyText.split(/\n\s*\n/).filter(p => p.trim());
            for (const para of paragraphs) {
                content.push({
                    type: 'paragraph',
                    content: [{ type: 'text', text: para.trim() }],
                });
            }
        }

        // Explicit paragraphs array
        if (Array.isArray(section.paragraphs)) {
            for (const para of section.paragraphs) {
                if (typeof para === 'string' && para.trim()) {
                    content.push({
                        type: 'paragraph',
                        content: [{ type: 'text', text: para.trim() }],
                    });
                }
            }
        }
    }

    return { type: 'doc', content };
}

// ---------------------------------------------------------------------------
// Requirements extraction
// ---------------------------------------------------------------------------

const REQ_KEYS = ['requirements', 'rfpRequirements', 'items', 'compliance', 'checklist'];

function findRequirements(parsed: Record<string, unknown>): RawRequirement[] {
    for (const key of REQ_KEYS) {
        const val = parsed[key];
        if (!Array.isArray(val) || val.length === 0) continue;

        const reqs: RawRequirement[] = [];
        for (const item of val) {
            if (typeof item === 'string') {
                reqs.push({ text: item });
            } else if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                const text = (obj.text || obj.description || obj.requirement || obj.label || obj.title) as string | undefined;
                if (typeof text === 'string' && text.trim()) {
                    reqs.push({
                        id: typeof obj.id === 'string' ? obj.id : undefined,
                        text: text.trim(),
                        section: typeof obj.section === 'string' ? obj.section : undefined,
                        priority: typeof obj.priority === 'string' ? obj.priority : undefined,
                    });
                }
            }
        }

        if (reqs.length > 0) return reqs;
    }

    // Also search one level deep in nested objects (e.g. { tender: { requirements: [...] } })
    for (const topKey of Object.keys(parsed)) {
        const topVal = parsed[topKey];
        if (!topVal || typeof topVal !== 'object' || Array.isArray(topVal)) continue;
        const nested = findRequirements(topVal as Record<string, unknown>);
        if (nested.length > 0) return nested;
    }

    return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract document content and requirements from a raw JSON string.
 * Never throws — returns nulls on failure.
 */
export function extractContentFromJson(rawJsonString: string): JsonContentResult {
    try {
        const parsed = JSON.parse(rawJsonString);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { doc: null, requirements: [] };
        }

        // 1. Find native TipTap doc
        let doc = findDocNode(parsed);

        // 2. Fallback: sections array → generate doc
        if (!doc) {
            const sections = findSections(parsed);
            if (sections && sections.length > 0) {
                doc = sectionsToDoc(sections);
            }
        }

        // Validate doc has at least one content node
        if (doc && (!doc.content || doc.content.length === 0)) {
            doc = null;
        }

        // 3. Requirements
        const requirements = findRequirements(parsed);

        return { doc, requirements };
    } catch {
        return { doc: null, requirements: [] };
    }
}

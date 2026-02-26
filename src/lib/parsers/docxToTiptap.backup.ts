/**
 * Direct DOCX → TipTap JSON Converter
 *
 * Deterministic conversion of word/document.xml to TipTap/ProseMirror JSON.
 * No AI involved — pure XML→JSON mapping with style inheritance.
 *
 * Reads:
 *   - word/document.xml    (content)
 *   - word/styles.xml      (style definitions + document defaults)
 *   - word/theme/theme1.xml (theme fonts + colors)
 *   - word/numbering.xml   (list types)
 *   - word/_rels/document.xml.rels (hyperlink targets)
 *
 * Server-only — used in /api/import/parse route.
 */

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { resolveRelationships } from './docxRelationships';
import { resolveNumbering } from './docxNumbering';

// ---------------------------------------------------------------------------
// TipTap node types
// ---------------------------------------------------------------------------

interface TipTapMark {
    type: string;
    attrs?: Record<string, unknown>;
}

interface TipTapNode {
    type: string;
    attrs?: Record<string, unknown>;
    content?: TipTapNode[];
    text?: string;
    marks?: TipTapMark[];
}

export interface TipTapDoc {
    type: 'doc';
    content: TipTapNode[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type XmlObj = Record<string, unknown>;

interface ThemeFontMap {
    major: string | null;
    minor: string | null;
}

type ThemeColorMap = Record<string, string>;

interface ThemeData {
    fonts: ThemeFontMap;
    colors: ThemeColorMap;
}

/** Resolved run properties at a single inheritance level */
interface RunStyleProps {
    fontFamily: string | null;
    fontSize: number | null;  // pt
    color: string | null;     // "#RRGGBB"
    bold: boolean | null;
    italic: boolean | null;
    underline: boolean | null;
    strike: boolean | null;
}

const EMPTY_RUN_STYLE: RunStyleProps = {
    fontFamily: null, fontSize: null, color: null,
    bold: null, italic: null, underline: null, strike: null,
};

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

function halfPointsToPt(val: unknown): number | null {
    const n = Number(val);
    if (!isFinite(n) || n <= 0) return null;
    return n / 2;
}

function normalizeColor(val: unknown): string | null {
    if (typeof val !== 'string' || !val) return null;
    const clean = val.replace(/^#/, '').toUpperCase();
    if (clean === 'AUTO' || clean.length < 3) return null;
    if (/^[0-9A-F]{6}$/.test(clean)) return `#${clean}`;
    if (/^[0-9A-F]{3}$/.test(clean)) return `#${clean}`;
    return null;
}

// ---------------------------------------------------------------------------
// Theme parsing
// ---------------------------------------------------------------------------

const COLOR_SLOTS = [
    'a:dk1', 'a:lt1', 'a:dk2', 'a:lt2',
    'a:accent1', 'a:accent2', 'a:accent3', 'a:accent4', 'a:accent5', 'a:accent6',
    'a:hlink', 'a:folHlink',
];

function extractSlotColor(slot: unknown): string | null {
    if (!slot || typeof slot !== 'object') return null;
    const srgb = child(slot, 'a:srgbClr');
    if (srgb) {
        const val = attr(srgb, 'val');
        if (val && /^[0-9A-Fa-f]{6}$/.test(val)) return val.toUpperCase();
    }
    const sys = child(slot, 'a:sysClr');
    if (sys) {
        const last = attr(sys, 'lastClr');
        if (last && /^[0-9A-Fa-f]{6}$/.test(last)) return last.toUpperCase();
    }
    return null;
}

function parseTheme(themeXml: string, parser: XMLParser): ThemeData {
    const result: ThemeData = { fonts: { major: null, minor: null }, colors: {} };
    try {
        const parsed = parser.parse(themeXml);
        const theme = parsed['a:theme'];
        if (!theme) return result;
        const elements = child(theme, 'a:themeElements');
        if (!elements) return result;

        const fontScheme = child(elements, 'a:fontScheme');
        if (fontScheme) {
            const majorFont = child(fontScheme, 'a:majorFont');
            if (majorFont) {
                const latin = child(majorFont, 'a:latin');
                if (latin) {
                    const tf = attr(latin, 'typeface');
                    if (tf && tf.trim()) result.fonts.major = tf.trim();
                }
            }
            const minorFont = child(fontScheme, 'a:minorFont');
            if (minorFont) {
                const latin = child(minorFont, 'a:latin');
                if (latin) {
                    const tf = attr(latin, 'typeface');
                    if (tf && tf.trim()) result.fonts.minor = tf.trim();
                }
            }
        }

        const clrScheme = child(elements, 'a:clrScheme');
        if (clrScheme) {
            for (const slotKey of COLOR_SLOTS) {
                const slot = child(clrScheme, slotKey);
                const hex = extractSlotColor(slot);
                if (hex) result.colors[slotKey.replace('a:', '')] = hex;
            }
        }
    } catch { /* optional */ }
    return result;
}

function resolveThemeFont(themeRef: string, fontMap: ThemeFontMap | null): string | null {
    if (!themeRef || !fontMap) return null;
    const lower = themeRef.toLowerCase();
    if (lower.includes('minor')) return fontMap.minor;
    if (lower.includes('major')) return fontMap.major;
    return null;
}

function resolveThemeColor(themeColorRef: string, colorMap: ThemeColorMap | null): string | null {
    if (!themeColorRef || !colorMap) return null;
    const hex = colorMap[themeColorRef];
    if (hex) return `#${hex}`;
    return null;
}

// ---------------------------------------------------------------------------
// Run property extraction (single inheritance level)
// ---------------------------------------------------------------------------

function extractRunStyleProps(rPr: unknown, themeData: ThemeData | null): RunStyleProps {
    const result: RunStyleProps = { ...EMPTY_RUN_STYLE };
    if (!rPr || typeof rPr !== 'object') return result;

    // Font family
    const rFonts = child(rPr, 'w:rFonts');
    if (rFonts) {
        const directFont = attr(rFonts, 'w:ascii') || attr(rFonts, 'w:hAnsi') || attr(rFonts, 'w:cs');
        if (directFont && directFont.trim()) {
            result.fontFamily = directFont.trim();
        } else {
            const themeRef = attr(rFonts, 'w:asciiTheme') || attr(rFonts, 'w:hAnsiTheme');
            if (themeRef) result.fontFamily = resolveThemeFont(themeRef, themeData?.fonts ?? null);
        }
    }

    // Font size
    const sz = child(rPr, 'w:sz');
    if (sz) result.fontSize = halfPointsToPt(attr(sz, 'w:val'));

    // Color extraction rules:
    // - w:val + w:themeColor + w:themeShade → Word default shaded theme color → ignore
    // - w:val + w:themeColor (no w:themeShade) → user chose a theme color → USE w:val
    // - Only w:val → explicit hex → USE it
    // - Only w:themeColor → resolve from theme
    const color = child(rPr, 'w:color');
    if (color) {
        const directColor = normalizeColor(attr(color, 'w:val'));
        const themeColorRef = attr(color, 'w:themeColor');
        const themeShade = attr(color, 'w:themeShade');
        if (directColor && themeColorRef && themeShade) {
            // Word default with shade modifier → ignore
        } else if (directColor) {
            // Explicit hex (with or without themeColor but no themeShade) → use it
            result.color = directColor;
        } else if (themeColorRef) {
            result.color = resolveThemeColor(themeColorRef, themeData?.colors ?? null);
        }
    }

    // Bold
    const b = child(rPr, 'w:b');
    if (b !== undefined) {
        const bVal = attr(b, 'w:val');
        result.bold = bVal === undefined || bVal === '1' || bVal === 'true';
    }

    // Italic
    const i = child(rPr, 'w:i');
    if (i !== undefined) {
        const iVal = attr(i, 'w:val');
        result.italic = iVal === undefined || iVal === '1' || iVal === 'true';
    }

    // Underline
    const u = child(rPr, 'w:u');
    if (u !== undefined) {
        const uVal = attr(u, 'w:val');
        result.underline = uVal !== undefined && uVal !== 'none';
    }

    // Strikethrough
    const strike = child(rPr, 'w:strike');
    if (strike !== undefined) {
        const sVal = attr(strike, 'w:val');
        result.strike = sVal === undefined || sVal === '1' || sVal === 'true';
    }

    return result;
}

// ---------------------------------------------------------------------------
// Style map from styles.xml
// ---------------------------------------------------------------------------

type StyleRunMap = Record<string, RunStyleProps>;
/** Map from styleId → heading level (1, 2, 3...) or 0 for non-heading */
type StyleHeadingMap = Record<string, number>;

/** Map from styleId → list type for style-based list detection */
type StyleListMap = Record<string, 'bullet' | 'ordered'>;

interface StyleData {
    styleMap: StyleRunMap;
    headingMap: StyleHeadingMap;
    listStyleMap: StyleListMap;
    docDefaults: RunStyleProps;
}

function buildStyleData(stylesXml: string, parser: XMLParser, themeData: ThemeData | null): StyleData {
    const styleMap: StyleRunMap = {};
    const headingMap: StyleHeadingMap = {};
    const listStyleMap: StyleListMap = {};
    let docDefaults: RunStyleProps = { ...EMPTY_RUN_STYLE };

    try {
        const parsed = parser.parse(stylesXml);
        const stylesRoot = parsed['w:styles'];
        if (!stylesRoot) return { styleMap, headingMap, listStyleMap, docDefaults };

        // Document defaults
        const docDef = child(stylesRoot, 'w:docDefaults');
        const rPrDefault = docDef ? child(docDef, 'w:rPrDefault') : null;
        const defaultRPr = rPrDefault ? child(rPrDefault, 'w:rPr') : null;
        docDefaults = extractRunStyleProps(defaultRPr, themeData);

        // Named styles
        const rawStyles = stylesRoot['w:style'];
        const styleList: XmlObj[] = Array.isArray(rawStyles) ? rawStyles : (rawStyles ? [rawStyles] : []);

        // Track w:basedOn references for second-pass heading inheritance
        const basedOnMap: Record<string, string> = {};

        for (const style of styleList) {
            const styleId = attr(style, 'w:styleId');
            if (!styleId) continue;

            const rPr = child(style, 'w:rPr');
            styleMap[styleId] = extractRunStyleProps(rPr, themeData);

            // Get the display name from w:name (used for heading + list detection)
            const nameNode = child(style, 'w:name');
            const nameVal = nameNode ? attr(nameNode, 'w:val') : undefined;

            // Track w:basedOn for inheritance
            const basedOnNode = child(style, 'w:basedOn');
            const basedOnId = basedOnNode ? attr(basedOnNode, 'w:val') : undefined;
            if (basedOnId) basedOnMap[styleId] = basedOnId;

            // Detect heading styles by styleId pattern (regex)
            const idMatch = styleId.match(/^heading\s*(\d)$/i);
            if (idMatch) headingMap[styleId] = parseInt(idMatch[1]);

            // Also check w:name for localized/display heading names
            if (nameVal && !headingMap[styleId]) {
                const nameMatch = nameVal.match(/^heading\s*(\d)$/i);
                if (nameMatch) headingMap[styleId] = parseInt(nameMatch[1]);
            }

            // Detect Title/Subtitle styles as heading levels
            if (!headingMap[styleId]) {
                const nameLower = nameVal?.toLowerCase() || '';
                if (nameLower === 'title') {
                    headingMap[styleId] = 1;
                } else if (nameLower === 'subtitle') {
                    headingMap[styleId] = 2;
                }
            }

            // Detect list styles by styleId and w:name
            // Check both the styleId and the display name
            const namesToCheck = [styleId.toLowerCase(), nameVal?.toLowerCase() || ''];
            for (const n of namesToCheck) {
                if (!n) continue;
                // Ordered list styles
                if (/^list\s*number/i.test(n) || /^listnumber/i.test(n)) {
                    listStyleMap[styleId] = 'ordered';
                    break;
                }
                // Bullet list styles
                if (/^list\s*bullet/i.test(n) || /^listbullet/i.test(n) ||
                    /^list\s*paragraph/i.test(n) || /^listparagraph/i.test(n)) {
                    listStyleMap[styleId] = 'bullet';
                    break;
                }
            }
        }

        // Second pass: inherit heading level from w:basedOn chain
        for (const styleId of Object.keys(basedOnMap)) {
            if (headingMap[styleId]) continue; // already detected
            let parentId: string | undefined = basedOnMap[styleId];
            const visited = new Set<string>();
            while (parentId && !visited.has(parentId)) {
                visited.add(parentId);
                if (headingMap[parentId]) {
                    headingMap[styleId] = headingMap[parentId];
                    break;
                }
                parentId = basedOnMap[parentId];
            }
        }

    } catch { /* silent */ }

    return { styleMap, headingMap, listStyleMap, docDefaults };
}

// ---------------------------------------------------------------------------
// Resolve merged run properties
// ---------------------------------------------------------------------------

function resolveRunProps(
    direct: RunStyleProps,
    paraRPr: RunStyleProps,
    styleRPr: RunStyleProps,
    defaults: RunStyleProps,
): RunStyleProps {
    return {
        fontFamily: direct.fontFamily ?? paraRPr.fontFamily ?? styleRPr.fontFamily ?? defaults.fontFamily,
        fontSize: direct.fontSize ?? paraRPr.fontSize ?? styleRPr.fontSize ?? defaults.fontSize,
        color: direct.color ?? paraRPr.color ?? styleRPr.color ?? defaults.color,
        bold: direct.bold ?? paraRPr.bold ?? styleRPr.bold ?? defaults.bold,
        italic: direct.italic ?? paraRPr.italic ?? styleRPr.italic ?? defaults.italic,
        underline: direct.underline ?? paraRPr.underline ?? styleRPr.underline ?? defaults.underline,
        strike: direct.strike ?? paraRPr.strike ?? styleRPr.strike ?? defaults.strike,
    };
}

// ---------------------------------------------------------------------------
// Build TipTap marks from resolved run properties
// ---------------------------------------------------------------------------

function buildMarks(props: RunStyleProps, extraMarks?: TipTapMark[]): TipTapMark[] | undefined {
    const marks: TipTapMark[] = extraMarks ? [...extraMarks] : [];

    if (props.bold) marks.push({ type: 'bold' });
    if (props.italic) marks.push({ type: 'italic' });
    if (props.underline) marks.push({ type: 'underline' });
    if (props.strike) marks.push({ type: 'strike' });

    // textStyle mark for color, fontSize, fontFamily
    const textStyleAttrs: Record<string, unknown> = {};
    if (props.color) textStyleAttrs.color = props.color;
    if (props.fontSize) textStyleAttrs.fontSize = `${props.fontSize}pt`;
    if (props.fontFamily) textStyleAttrs.fontFamily = props.fontFamily;

    if (Object.keys(textStyleAttrs).length > 0) {
        marks.push({ type: 'textStyle', attrs: textStyleAttrs });
    }

    return marks.length > 0 ? marks : undefined;
}

// ---------------------------------------------------------------------------
// Text extraction from w:t
// ---------------------------------------------------------------------------

function getRunText(run: XmlObj): string {
    const wt = run['w:t'];
    if (wt === undefined || wt === null) return '';
    if (typeof wt === 'string') return wt;
    if (typeof wt === 'number') return String(wt);
    if (Array.isArray(wt)) {
        return wt.map(t => {
            if (typeof t === 'string') return t;
            if (t && typeof t === 'object' && '#text' in t) return String(t['#text']);
            return '';
        }).join('');
    }
    if (typeof wt === 'object' && '#text' in wt) return String(wt['#text']);
    return '';
}

// ---------------------------------------------------------------------------
// Run merging — combine adjacent text nodes with identical marks
// ---------------------------------------------------------------------------

function marksEqual(a: TipTapMark[] | undefined, b: TipTapMark[] | undefined): boolean {
    const aStr = JSON.stringify(a || []);
    const bStr = JSON.stringify(b || []);
    return aStr === bStr;
}

function mergeAdjacentRuns(nodes: TipTapNode[]): TipTapNode[] {
    if (nodes.length <= 1) return nodes;
    const merged: TipTapNode[] = [];

    for (const node of nodes) {
        const prev = merged[merged.length - 1];
        if (
            prev &&
            prev.type === 'text' && node.type === 'text' &&
            prev.text && node.text &&
            marksEqual(prev.marks, node.marks)
        ) {
            prev.text += node.text;
        } else {
            merged.push({ ...node });
        }
    }

    return merged;
}

// ---------------------------------------------------------------------------
// Convert a single w:r (run) to TipTap nodes
// ---------------------------------------------------------------------------

function convertRun(
    run: XmlObj,
    themeData: ThemeData | null,
    paraRPr: RunStyleProps,
    styleRPr: RunStyleProps,
    docDefaults: RunStyleProps,
    linkMark?: TipTapMark,
): TipTapNode[] {
    const nodes: TipTapNode[] = [];

    // Check for w:br (line break) — also check 'br' without namespace prefix
    if (child(run, 'w:br') !== undefined || child(run, 'br') !== undefined) {
        nodes.push({ type: 'hardBreak' });
        return nodes;
    }

    // Check for w:tab (tab character → space)
    if (child(run, 'w:tab') !== undefined) {
        // Represent tab as a space in TipTap
        const directProps = extractRunStyleProps(child(run, 'w:rPr'), themeData);
        const resolved = resolveRunProps(directProps, paraRPr, styleRPr, docDefaults);
        const extraMarks = linkMark ? [linkMark] : undefined;
        const marks = buildMarks(resolved, extraMarks);
        const textNode: TipTapNode = { type: 'text', text: '\t' };
        if (marks) textNode.marks = marks;
        nodes.push(textNode);
        return nodes;
    }

    const text = getRunText(run);
    if (!text) return nodes;

    // Resolve run properties with inheritance
    const directProps = extractRunStyleProps(child(run, 'w:rPr'), themeData);
    const resolved = resolveRunProps(directProps, paraRPr, styleRPr, docDefaults);

    const extraMarks = linkMark ? [linkMark] : undefined;
    const marks = buildMarks(resolved, extraMarks);

    const textNode: TipTapNode = { type: 'text', text };
    if (marks) textNode.marks = marks;
    nodes.push(textNode);

    return nodes;
}

// ---------------------------------------------------------------------------
// Convert a w:p (paragraph) to TipTap node
// ---------------------------------------------------------------------------

interface ParagraphMeta {
    nodeType: 'paragraph' | 'heading';
    headingLevel?: number;
    numId?: string;
    ilvl?: number;
}

function getParagraphMeta(
    para: XmlObj,
    headingMap: StyleHeadingMap,
    listStyleMap: StyleListMap,
): { meta: ParagraphMeta; styleName: string; paraRPr: XmlObj | undefined } {
    const pPr = child(para, 'w:pPr');
    const pStyleNode = pPr ? child(pPr, 'w:pStyle') : null;
    const styleName = pStyleNode ? (attr(pStyleNode, 'w:val') || 'Normal') : 'Normal';

    const headingLevel = headingMap[styleName];
    const paraRPr = pPr ? child(pPr, 'w:rPr') as XmlObj | undefined : undefined;

    // Check for list numbering (explicit w:numPr)
    const numPr = pPr ? child(pPr, 'w:numPr') : null;
    let numId: string | undefined;
    let ilvl: number | undefined;
    if (numPr) {
        const numIdNode = child(numPr, 'w:numId');
        const rawNumId = numIdNode ? attr(numIdNode, 'w:val') : undefined;
        // numId "0" means "no numbering" in OOXML — skip it
        numId = rawNumId && rawNumId !== '0' ? rawNumId : undefined;
        const ilvlNode = child(numPr, 'w:ilvl');
        ilvl = ilvlNode ? Number(attr(ilvlNode, 'w:val') || '0') : 0;
    }

    // Fallback: detect list by paragraph style name (e.g. ListParagraph, ListBullet)
    // Use the styleName as a synthetic "numId" grouping key with "style:" prefix
    if (!numId && listStyleMap[styleName]) {
        numId = `style:${styleName}`;
        ilvl = 0;
    }

    // List items take priority over heading detection for node grouping
    const meta: ParagraphMeta = numId
        ? { nodeType: 'paragraph', numId, ilvl }
        : headingLevel
            ? { nodeType: 'heading', headingLevel: Math.min(headingLevel, 3) }
            : { nodeType: 'paragraph' };

    return { meta, styleName, paraRPr };
}

function convertParagraphContent(
    para: XmlObj,
    themeData: ThemeData | null,
    styleData: StyleData,
    styleName: string,
    paraRPrXml: XmlObj | undefined,
    rels: Map<string, string>,
): TipTapNode[] {
    const paraRPr = extractRunStyleProps(paraRPrXml, themeData);
    const styleRPr = styleData.styleMap[styleName] || { ...EMPTY_RUN_STYLE };
    const contentNodes: TipTapNode[] = [];

    // Process all child elements in order
    // We need to handle both w:r (runs) and w:hyperlink elements
    const paraObj = para as XmlObj;

    // Process runs
    const runs = children(para, 'w:r');
    for (const run of runs) {
        const nodes = convertRun(run, themeData, paraRPr, styleRPr, styleData.docDefaults);
        contentNodes.push(...nodes);
    }

    // Process hyperlinks
    const hyperlinks = children(para, 'w:hyperlink');
    for (const hyperlink of hyperlinks) {
        const rId = attr(hyperlink, 'r:id');
        const href = rId ? rels.get(rId) : undefined;
        const linkMark: TipTapMark | undefined = href
            ? { type: 'link', attrs: { href } }
            : undefined;

        const hlRuns = children(hyperlink, 'w:r');
        for (const run of hlRuns) {
            const nodes = convertRun(run, themeData, paraRPr, styleRPr, styleData.docDefaults, linkMark);
            contentNodes.push(...nodes);
        }
    }

    // Process structured document tags (w:sdt) — unwrap to inner content
    const sdts = children(paraObj, 'w:sdt');
    for (const sdt of sdts) {
        const sdtContent = child(sdt, 'w:sdtContent');
        if (sdtContent) {
            const sdtRuns = children(sdtContent, 'w:r');
            for (const run of sdtRuns) {
                const nodes = convertRun(run, themeData, paraRPr, styleRPr, styleData.docDefaults);
                contentNodes.push(...nodes);
            }
        }
    }

    return mergeAdjacentRuns(contentNodes);
}

// ---------------------------------------------------------------------------
// List grouping
// ---------------------------------------------------------------------------

interface ListGroup {
    type: 'bulletList' | 'orderedList';
    items: TipTapNode[]; // listItem nodes
}

function groupListParagraphs(
    paragraphsWithMeta: Array<{ node: TipTapNode; meta: ParagraphMeta }>,
    numberingMap: Map<string, 'bullet' | 'ordered'>,
    listStyleMap: StyleListMap,
): TipTapNode[] {
    const result: TipTapNode[] = [];
    let currentList: ListGroup | null = null;
    let currentNumId: string | null = null;

    for (const { node, meta } of paragraphsWithMeta) {
        if (meta.numId) {
            // Resolve list type: check numberingMap first, then listStyleMap for style-based keys
            let listType: 'bullet' | 'ordered' = 'bullet';
            if (meta.numId.startsWith('style:')) {
                const styleId = meta.numId.slice(6); // remove "style:" prefix
                listType = listStyleMap[styleId] || 'bullet';
            } else {
                listType = numberingMap.get(meta.numId) || 'bullet';
            }
            const tipTapListType = listType === 'ordered' ? 'orderedList' : 'bulletList';

            // Continue existing list or start new one
            if (currentList && currentNumId === meta.numId && currentList.type === tipTapListType) {
                // Add to current list
                currentList.items.push({
                    type: 'listItem',
                    content: [node],
                });
            } else {
                // Flush previous list
                if (currentList) {
                    result.push({
                        type: currentList.type,
                        content: currentList.items,
                    });
                }
                // Start new list
                currentList = {
                    type: tipTapListType,
                    items: [{
                        type: 'listItem',
                        content: [node],
                    }],
                };
                currentNumId = meta.numId;
            }
        } else {
            // Non-list paragraph — flush current list
            if (currentList) {
                result.push({
                    type: currentList.type,
                    content: currentList.items,
                });
                currentList = null;
                currentNumId = null;
            }
            result.push(node);
        }
    }

    // Flush final list
    if (currentList) {
        result.push({
            type: currentList.type,
            content: currentList.items,
        });
    }

    return result;
}

// ---------------------------------------------------------------------------
// Table conversion
// ---------------------------------------------------------------------------

function convertTable(
    tbl: XmlObj,
    themeData: ThemeData | null,
    styleData: StyleData,
    rels: Map<string, string>,
): TipTapNode | null {
    const rows = children(tbl, 'w:tr');
    if (rows.length === 0) return null;

    const tableRows: TipTapNode[] = [];

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const cells = children(row, 'w:tc');
        const tableCells: TipTapNode[] = [];

        for (const cell of cells) {
            const cellParagraphs = children(cell, 'w:p');
            const cellContent: TipTapNode[] = [];

            for (const para of cellParagraphs) {
                const { meta, styleName, paraRPr } = getParagraphMeta(para, styleData.headingMap, styleData.listStyleMap);
                const content = convertParagraphContent(para, themeData, styleData, styleName, paraRPr, rels);

                if (content.length === 0) continue;

                const node: TipTapNode = meta.nodeType === 'heading'
                    ? { type: 'heading', attrs: { level: meta.headingLevel }, content }
                    : { type: 'paragraph', content };

                cellContent.push(node);
            }

            // Ensure cell has at least one paragraph
            if (cellContent.length === 0) {
                cellContent.push({ type: 'paragraph', content: [{ type: 'text', text: '' }] });
            }

            // Use tableHeader for first row, tableCell for others
            tableCells.push({
                type: rowIdx === 0 ? 'tableHeader' : 'tableCell',
                content: cellContent,
            });
        }

        tableRows.push({
            type: 'tableRow',
            content: tableCells,
        });
    }

    return {
        type: 'table',
        content: tableRows,
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a DOCX ArrayBuffer directly to a TipTap JSON document.
 * Deterministic — no AI involved. Never throws — returns minimal doc on failure.
 */
export async function convertDocxToTiptap(arrayBuffer: ArrayBuffer): Promise<TipTapDoc> {
    const emptyDoc: TipTapDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

    try {
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Read document.xml
        const docFile = zip.file('word/document.xml');
        if (!docFile) return emptyDoc;
        const docXml = await docFile.async('text');

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            removeNSPrefix: false,
            preserveOrder: false,
            trimValues: false,
        });

        // Step 1: Parse theme first (styles depend on it)
        const themeData = await (async () => {
            const themeFile = zip.file('word/theme/theme1.xml');
            if (!themeFile) return null;
            const themeXml = await themeFile.async('text');
            return parseTheme(themeXml, parser);
        })();

        // Step 2: Parse styles using themeData
        const styleData = await (async () => {
            const stylesFile = zip.file('word/styles.xml');
            if (!stylesFile) return { styleMap: {}, headingMap: {}, listStyleMap: {}, docDefaults: { ...EMPTY_RUN_STYLE } } as StyleData;
            const stylesXml = await stylesFile.async('text');
            return buildStyleData(stylesXml, parser, themeData);
        })();

        // Step 3: Parse remaining auxiliary files in parallel
        const [rels, numberingMap] = await Promise.all([
            resolveRelationships(zip),
            resolveNumbering(zip),
        ]);

        // Parse document.xml
        const parsed = parser.parse(docXml);
        const docRoot = parsed['w:document'];
        if (!docRoot) return emptyDoc;
        const body = child(docRoot, 'w:body');
        if (!body) return emptyDoc;

        // Iterate body children: w:p (paragraphs) and w:tbl (tables)
        const bodyObj = body as XmlObj;
        const paragraphsWithMeta: Array<{ node: TipTapNode; meta: ParagraphMeta }> = [];
        const topLevelNodes: TipTapNode[] = [];

        // We need to process body children in order to maintain document flow
        // fast-xml-parser without preserveOrder groups by tag name,
        // so we process paragraphs and tables, then rely on their natural order.
        // For interleaved tables and paragraphs, we process paragraphs first,
        // then insert tables at appropriate positions.

        // Process all paragraphs
        const paragraphs = children(bodyObj, 'w:p');

        for (const para of paragraphs) {
            const { meta, styleName, paraRPr } = getParagraphMeta(para, styleData.headingMap, styleData.listStyleMap);
            const content = convertParagraphContent(para, themeData, styleData, styleName, paraRPr, rels);

            // Skip empty paragraphs (no text content)
            if (content.length === 0) continue;

            const node: TipTapNode = meta.nodeType === 'heading'
                ? { type: 'heading', attrs: { level: meta.headingLevel }, content }
                : { type: 'paragraph', content };

            paragraphsWithMeta.push({ node, meta });
        }

        // Debug: log list detection stats
        const listParas = paragraphsWithMeta.filter(p => p.meta.numId);
        const styleListParas = listParas.filter(p => p.meta.numId?.startsWith('style:'));
        const numPrListParas = listParas.length - styleListParas.length;
        const uniqueStyles = [...new Set(paragraphs.map(p => {
            const pPr = child(p, 'w:pPr');
            const pStyle = pPr ? child(pPr, 'w:pStyle') : null;
            return pStyle ? attr(pStyle, 'w:val') : 'Normal';
        }))];
        const listCount = listParas.length;
        console.log('[docxToTiptap]', paragraphs.length, 'paragraphs,',
            listCount, 'list items, styles:', uniqueStyles);

        // Group list items and build paragraph sequence
        const paragraphNodes = groupListParagraphs(paragraphsWithMeta, numberingMap, styleData.listStyleMap);
        topLevelNodes.push(...paragraphNodes);

        // Process tables and append at end (best effort ordering)
        const tables = children(bodyObj, 'w:tbl');
        for (const tbl of tables) {
            const tableNode = convertTable(tbl, themeData, styleData, rels);
            if (tableNode) topLevelNodes.push(tableNode);
        }

        if (topLevelNodes.length === 0) return emptyDoc;

        return { type: 'doc', content: topLevelNodes };
    } catch (err) {
        console.error('[convertDocxToTiptap] Failed:', err);
        return emptyDoc;
    }
}

/**
 * Extract plain text from parsed paragraphs for requirements analysis.
 * Returns text with paragraph boundaries marked by newlines.
 */
export function extractPlainTextForRequirements(doc: TipTapDoc): string {
    const lines: string[] = [];

    function walkNode(node: TipTapNode): void {
        if (node.type === 'text' && node.text) {
            lines.push(node.text);
        } else if (node.type === 'hardBreak') {
            lines.push('\n');
        } else if (node.type === 'heading' || node.type === 'paragraph') {
            const textParts: string[] = [];
            if (node.content) {
                for (const child of node.content) {
                    if (child.type === 'text' && child.text) textParts.push(child.text);
                    else if (child.type === 'hardBreak') textParts.push('\n');
                }
            }
            if (textParts.length > 0) {
                lines.push(textParts.join(''));
                lines.push('\n');
            }
        } else if (node.content) {
            for (const child of node.content) {
                walkNode(child);
            }
        }
    }

    for (const node of doc.content) {
        walkNode(node);
    }

    return lines.join('').trim();
}

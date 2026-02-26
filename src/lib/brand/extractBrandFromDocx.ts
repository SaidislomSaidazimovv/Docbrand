/**
 * Extract document-level brand typography from a DOCX file's styles.xml.
 *
 * Uses jszip to unzip the DOCX and fast-xml-parser to parse styles.xml,
 * extracting the document defaults and named style formatting (Normal,
 * Heading1, Heading2) as brand tokens for styleStore.
 *
 * Server-only — used in /api/import/parse route.
 */

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface DocxBrand {
    fontFamily: string | null;
    fontSize: number | null;   // px
    lineHeight: number | null;
    spaceBefore: number | null; // pt
    spaceAfter: number | null;  // pt
    h1Color: string | null;    // hex "#RRGGBB"
    h2Color: string | null;
    bodyColor: string | null;
    h1FontSize: number | null; // px
    h2FontSize: number | null; // px
    h1SpaceBefore: number | null; // pt
    h1SpaceAfter: number | null;  // pt
    h2SpaceBefore: number | null; // pt
    h2SpaceAfter: number | null;  // pt
    h3Color: string | null;
    h3FontSize: number | null; // px
    h3SpaceBefore: number | null; // pt
    h3SpaceAfter: number | null;  // pt
    margins: { top: number; bottom: number; left: number; right: number } | null;
    pageSize: { width: number; height: number; orientation: 'portrait' | 'landscape' } | null;
}

const EMPTY: DocxBrand = {
    fontFamily: null,
    fontSize: null,
    lineHeight: null,
    spaceBefore: null,
    spaceAfter: null,
    h1Color: null,
    h2Color: null,
    bodyColor: null,
    h1FontSize: null,
    h2FontSize: null,
    h1SpaceBefore: null,
    h1SpaceAfter: null,
    h2SpaceBefore: null,
    h2SpaceAfter: null,
    h3Color: null,
    h3FontSize: null,
    h3SpaceBefore: null,
    h3SpaceAfter: null,
    margins: null,
    pageSize: null,
};

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

/** w:sz value is in half-points → convert to px (1pt = 1.333px) */
function halfPointsToPx(val: unknown): number | null {
    const n = Number(val);
    if (!isFinite(n) || n <= 0) return null;
    return Math.round((n / 2) * 1.333);
}

/** w:spacing/@w:line is in twips (1/20 pt). 240 = single spacing. */
function twipsToLineHeight(val: unknown): number | null {
    const n = Number(val);
    if (!isFinite(n) || n <= 0) return null;
    // Normalize: 240 twips = 1.0 line height
    const ratio = Math.round((n / 240) * 100) / 100;
    return ratio > 0 ? ratio : null;
}

/** w:spacing/@w:before or @w:after in twips → pt */
function twipsToPt(val: unknown): number | null {
    const n = Number(val);
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n / 20);
}

/** Ensure color is a hex string with # prefix */
function normalizeColor(val: unknown): string | null {
    if (typeof val !== 'string' || !val) return null;
    const clean = val.replace(/^#/, '').toUpperCase();
    // Skip "auto" or invalid values
    if (clean === 'AUTO' || clean.length < 3) return null;
    if (/^[0-9A-F]{6}$/.test(clean)) return `#${clean}`;
    if (/^[0-9A-F]{3}$/.test(clean)) return `#${clean}`;
    return null;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

type XmlObj = Record<string, unknown>;

/** Safely access a nested attribute value from the parsed XML object. */
function attr(obj: unknown, attrName: string): string | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const rec = obj as XmlObj;
    // fast-xml-parser with attributeNamePrefix='' puts attrs directly on the node
    return rec[attrName] as string | undefined;
}

/** Get a child element, handling both single object and array cases. */
function child(obj: unknown, key: string): XmlObj | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const rec = obj as XmlObj;
    const val = rec[key];
    if (!val) return undefined;
    if (Array.isArray(val)) return val[0] as XmlObj;
    return val as XmlObj;
}

// ---------------------------------------------------------------------------
// Theme maps (fonts + colors from word/theme/theme1.xml)
// ---------------------------------------------------------------------------

/** Resolved font names from theme */
interface ThemeFontMap {
    major: string | null; // headings (majorFont → a:latin @typeface)
    minor: string | null; // body    (minorFont → a:latin @typeface)
}

/** Resolved color palette from theme (dk1, accent1, etc.) */
type ThemeColorMap = Record<string, string>; // key → 6-char hex (no #)

interface ThemeData {
    fonts: ThemeFontMap;
    colors: ThemeColorMap;
}

/** Extract a color hex from a theme color slot (a:sysClr or a:srgbClr). */
function extractSlotColor(slot: unknown): string | null {
    if (!slot || typeof slot !== 'object') return null;
    // a:srgbClr @val — direct hex
    const srgb = child(slot, 'a:srgbClr');
    if (srgb) {
        const val = attr(srgb, 'val');
        if (val && /^[0-9A-Fa-f]{6}$/.test(val)) return val.toUpperCase();
    }
    // a:sysClr @lastClr — system color with cached last value
    const sys = child(slot, 'a:sysClr');
    if (sys) {
        const last = attr(sys, 'lastClr');
        if (last && /^[0-9A-Fa-f]{6}$/.test(last)) return last.toUpperCase();
    }
    return null;
}

const COLOR_SLOTS = [
    'a:dk1', 'a:lt1', 'a:dk2', 'a:lt2',
    'a:accent1', 'a:accent2', 'a:accent3', 'a:accent4', 'a:accent5', 'a:accent6',
    'a:hlink', 'a:folHlink',
];

function parseTheme(themeXml: string, parser: XMLParser): ThemeData {
    const result: ThemeData = {
        fonts: { major: null, minor: null },
        colors: {},
    };
    try {
        const parsed = parser.parse(themeXml);
        const theme = parsed['a:theme'];
        if (!theme) return result;
        const elements = child(theme, 'a:themeElements');
        if (!elements) return result;

        // --- Fonts ---
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

        // --- Colors ---
        const clrScheme = child(elements, 'a:clrScheme');
        if (clrScheme) {
            for (const slotKey of COLOR_SLOTS) {
                const slot = child(clrScheme, slotKey);
                const hex = extractSlotColor(slot);
                if (hex) {
                    // Store without namespace prefix: "a:accent1" → "accent1"
                    const name = slotKey.replace('a:', '');
                    result.colors[name] = hex;
                }
            }
        }
    } catch {
        // Silent — theme parsing is optional
    }
    return result;
}

/** Resolve a theme reference like "minorHAnsi" or "majorHAnsi" to an actual font name. */
function resolveThemeFont(themeRef: string, fontMap: ThemeFontMap | null): string | null {
    if (!themeRef || !fontMap) return null;
    const lower = themeRef.toLowerCase();
    if (lower.includes('minor')) return fontMap.minor;
    if (lower.includes('major')) return fontMap.major;
    return null;
}

/** Resolve a theme color reference like "accent1" or "dk1" to a hex color. */
function resolveThemeColor(themeColorRef: string, colorMap: ThemeColorMap | null): string | null {
    if (!themeColorRef || !colorMap) return null;
    const hex = colorMap[themeColorRef];
    if (hex) return `#${hex}`;
    return null;
}

// ---------------------------------------------------------------------------
// Style extractors
// ---------------------------------------------------------------------------

interface RunProps {
    fontFamily: string | null;
    fontSize: number | null;
    color: string | null;
}

function extractRunProps(rPr: unknown, themeData: ThemeData | null): RunProps {
    const result: RunProps = { fontFamily: null, fontSize: null, color: null };
    if (!rPr || typeof rPr !== 'object') return result;

    // Font family: direct w:ascii/w:hAnsi first, then theme reference fallback
    const rFonts = child(rPr, 'w:rFonts');
    if (rFonts) {
        const directFont = attr(rFonts, 'w:ascii') || attr(rFonts, 'w:hAnsi') || attr(rFonts, 'w:cs');
        if (directFont && directFont.trim()) {
            result.fontFamily = directFont.trim();
        } else {
            const themeRef = attr(rFonts, 'w:asciiTheme') || attr(rFonts, 'w:hAnsiTheme');
            if (themeRef) {
                result.fontFamily = resolveThemeFont(themeRef, themeData?.fonts ?? null);
            }
        }
    }

    // Font size: w:sz/@w:val (half-points)
    const sz = child(rPr, 'w:sz');
    if (sz) result.fontSize = halfPointsToPx(attr(sz, 'w:val'));

    // Color extraction: only return colors the user intentionally set.
    // - CASE 1: w:val without w:themeColor → pure custom hex (skip 000000, FFFFFF)
    // - CASE 2: w:themeColor + w:themeShade → user darkened intentionally → use w:val
    // - CASE 3: w:themeColor + w:themeTint → user lightened intentionally → use w:val
    // - w:themeColor alone (no shade/tint) → Word default → null
    // - w:val = 000000/FFFFFF with themeColor → default black/white → null
    const color = child(rPr, 'w:color');
    if (color) {
        const directColor = normalizeColor(attr(color, 'w:val'));
        const themeColorRef = attr(color, 'w:themeColor');
        const themeShade = attr(color, 'w:themeShade');
        const themeTint = attr(color, 'w:themeTint');

        if (directColor && directColor !== '#000000' && directColor !== '#FFFFFF') {
            if (!themeColorRef || themeShade || themeTint) {
                result.color = directColor;
            }
        }
    }

    return result;
}

interface ParaProps {
    lineHeight: number | null;
    spaceBefore: number | null;
    spaceAfter: number | null;
}

function extractParaProps(pPr: unknown): ParaProps {
    const result: ParaProps = { lineHeight: null, spaceBefore: null, spaceAfter: null };
    if (!pPr || typeof pPr !== 'object') return result;

    const spacing = child(pPr, 'w:spacing');
    if (spacing) {
        result.lineHeight = twipsToLineHeight(attr(spacing, 'w:line'));
        result.spaceBefore = twipsToPt(attr(spacing, 'w:before'));
        result.spaceAfter = twipsToPt(attr(spacing, 'w:after'));
    }

    return result;
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

/**
 * Extract document-level brand typography from a DOCX ArrayBuffer.
 * Never throws — returns empty brand on any failure.
 */
export async function extractBrandFromDocx(arrayBuffer: ArrayBuffer): Promise<DocxBrand> {
    try {
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Read styles.xml
        const stylesFile = zip.file('word/styles.xml');
        if (!stylesFile) return { ...EMPTY };

        const stylesXml = await stylesFile.async('text');

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            // Preserve namespace prefixes (w:p, w:rPr, etc.)
            removeNSPrefix: false,
        });

        // Parse theme1.xml for font + color resolution (optional — may not exist)
        let themeData: ThemeData | null = null;
        const themeFile = zip.file('word/theme/theme1.xml');
        if (themeFile) {
            const themeXml = await themeFile.async('text');
            themeData = parseTheme(themeXml, parser);
        }

        const parsed = parser.parse(stylesXml);
        const stylesRoot = parsed['w:styles'];
        if (!stylesRoot) return { ...EMPTY };

        // 1. Document defaults — w:docDefaults
        const docDefaults = child(stylesRoot, 'w:docDefaults');
        const rPrDefault = docDefaults ? child(docDefaults, 'w:rPrDefault') : null;
        const defaultRPr = rPrDefault ? child(rPrDefault, 'w:rPr') : null;
        const defaultRunProps = extractRunProps(defaultRPr, themeData);

        const pPrDefault = docDefaults ? child(docDefaults, 'w:pPrDefault') : null;
        const defaultPPr = pPrDefault ? child(pPrDefault, 'w:pPr') : null;
        const defaultParaProps = extractParaProps(defaultPPr);

        // 2. Named styles — detect headings with regex + basedOn chain (same as docxToTiptap.ts)
        const rawStyles = stylesRoot['w:style'];
        const styleList: XmlObj[] = Array.isArray(rawStyles) ? rawStyles : (rawStyles ? [rawStyles] : []);

        let normalRun: RunProps = { fontFamily: null, fontSize: null, color: null };
        let normalPara: ParaProps = { lineHeight: null, spaceBefore: null, spaceAfter: null };

        const headingMap: Record<string, number> = {};
        const basedOnMap: Record<string, string> = {};
        const styleRunMap: Record<string, RunProps> = {};
        const styleParaMap: Record<string, ParaProps> = {};

        for (const style of styleList) {
            const styleId = attr(style, 'w:styleId') as string | undefined;
            if (!styleId) continue;

            const rPr = child(style, 'w:rPr');
            const pPr = child(style, 'w:pPr');
            styleRunMap[styleId] = extractRunProps(rPr, themeData);
            styleParaMap[styleId] = extractParaProps(pPr);

            const nameNode = child(style, 'w:name');
            const nameVal = nameNode ? (attr(nameNode, 'w:val') as string | undefined) : undefined;

            // Track basedOn for inheritance
            const basedOnNode = child(style, 'w:basedOn');
            const basedOnId = basedOnNode ? (attr(basedOnNode, 'w:val') as string | undefined) : undefined;
            if (basedOnId) basedOnMap[styleId] = basedOnId;

            // Detect Normal
            if (styleId === 'Normal' || styleId === 'normal' ||
                (nameVal && nameVal.toLowerCase() === 'normal')) {
                normalRun = styleRunMap[styleId];
                normalPara = styleParaMap[styleId];
            }

            // Detect heading by styleId regex
            const idMatch = styleId.match(/^heading\s*(\d)$/i);
            if (idMatch) headingMap[styleId] = parseInt(idMatch[1]);

            // Detect heading by w:name
            if (nameVal && !headingMap[styleId]) {
                const nameMatch = nameVal.match(/^heading\s*(\d)$/i);
                if (nameMatch) headingMap[styleId] = parseInt(nameMatch[1]);
            }

            // Title/Subtitle intentionally NOT mapped to heading levels.
            // User spec: heading detection ONLY from w:styleId (Heading1, Heading2, Heading3).
        }

        // Second pass: inherit heading level from basedOn chain
        for (const sid of Object.keys(basedOnMap)) {
            if (headingMap[sid]) continue;
            let parentId: string | undefined = basedOnMap[sid];
            const visited = new Set<string>();
            while (parentId && !visited.has(parentId)) {
                visited.add(parentId);
                if (headingMap[parentId]) {
                    headingMap[sid] = headingMap[parentId];
                    break;
                }
                parentId = basedOnMap[parentId];
            }
        }

        // Find first H1, H2, and H3 style props
        let h1Run: RunProps = { fontFamily: null, fontSize: null, color: null };
        let h1Para: ParaProps = { lineHeight: null, spaceBefore: null, spaceAfter: null };
        let h2Run: RunProps = { fontFamily: null, fontSize: null, color: null };
        let h2Para: ParaProps = { lineHeight: null, spaceBefore: null, spaceAfter: null };
        let h3Run: RunProps = { fontFamily: null, fontSize: null, color: null };
        let h3Para: ParaProps = { lineHeight: null, spaceBefore: null, spaceAfter: null };
        let foundH1 = false;
        let foundH2 = false;
        let foundH3 = false;

        for (const [sid, level] of Object.entries(headingMap)) {
            if (level === 1 && !foundH1) {
                h1Run = styleRunMap[sid] || h1Run;
                h1Para = styleParaMap[sid] || h1Para;
                foundH1 = true;
            } else if (level === 2 && !foundH2) {
                h2Run = styleRunMap[sid] || h2Run;
                h2Para = styleParaMap[sid] || h2Para;
                foundH2 = true;
            } else if (level === 3 && !foundH3) {
                h3Run = styleRunMap[sid] || h3Run;
                h3Para = styleParaMap[sid] || h3Para;
                foundH3 = true;
            }
            if (foundH1 && foundH2 && foundH3) break;
        }

        // 3. Extract page margins and size from document.xml sectPr
        let margins: DocxBrand['margins'] = null;
        let pageSize: DocxBrand['pageSize'] = null;

        const docFile = zip.file('word/document.xml');
        if (docFile) {
            const docXml = await docFile.async('text');
            const docParsed = parser.parse(docXml);
            const docRoot = docParsed['w:document'];
            const body = docRoot ? child(docRoot, 'w:body') : null;
            const sectPr = body ? child(body, 'w:sectPr') : null;

            if (sectPr) {
                const pgMar = child(sectPr, 'w:pgMar');
                if (pgMar) {
                    const top = twipsToPt(attr(pgMar, 'w:top'));
                    const bottom = twipsToPt(attr(pgMar, 'w:bottom'));
                    const left = twipsToPt(attr(pgMar, 'w:left'));
                    const right = twipsToPt(attr(pgMar, 'w:right'));
                    if (top !== null && bottom !== null && left !== null && right !== null) {
                        margins = { top, bottom, left, right };
                    }
                }

                const pgSz = child(sectPr, 'w:pgSz');
                if (pgSz) {
                    const wVal = Number(attr(pgSz, 'w:w'));
                    const hVal = Number(attr(pgSz, 'w:h'));
                    const orient = attr(pgSz, 'w:orient');
                    if (isFinite(wVal) && isFinite(hVal) && wVal > 0 && hVal > 0) {
                        pageSize = {
                            width: Math.round(wVal / 20),
                            height: Math.round(hVal / 20),
                            orientation: orient === 'landscape' ? 'landscape' : 'portrait',
                        };
                    }
                }
            }
        }

        // 4. Build brand — priority: Named style > Document defaults
        return {
            fontFamily: normalRun.fontFamily || defaultRunProps.fontFamily,
            fontSize: normalRun.fontSize || defaultRunProps.fontSize,
            lineHeight: normalPara.lineHeight || defaultParaProps.lineHeight,
            spaceBefore: normalPara.spaceBefore ?? defaultParaProps.spaceBefore,
            spaceAfter: normalPara.spaceAfter ?? defaultParaProps.spaceAfter,
            h1Color: h1Run.color,
            h2Color: h2Run.color,
            bodyColor: normalRun.color || defaultRunProps.color,
            h1FontSize: h1Run.fontSize,
            h2FontSize: h2Run.fontSize,
            h1SpaceBefore: h1Para.spaceBefore,
            h1SpaceAfter: h1Para.spaceAfter,
            h2SpaceBefore: h2Para.spaceBefore,
            h2SpaceAfter: h2Para.spaceAfter,
            h3Color: h3Run.color,
            h3FontSize: h3Run.fontSize,
            h3SpaceBefore: h3Para.spaceBefore,
            h3SpaceAfter: h3Para.spaceAfter,
            margins,
            pageSize,
        };
    } catch {
        return { ...EMPTY };
    }
}

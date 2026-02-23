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

    // Color: direct w:val first, then w:themeColor fallback
    const color = child(rPr, 'w:color');
    if (color) {
        const directColor = normalizeColor(attr(color, 'w:val'));
        if (directColor) {
            result.color = directColor;
        } else {
            const themeColorRef = attr(color, 'w:themeColor');
            if (themeColorRef) {
                result.color = resolveThemeColor(themeColorRef, themeData?.colors ?? null);
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

        // 2. Named styles — find Normal, Heading1, Heading2
        const rawStyles = stylesRoot['w:style'];
        const styleList: XmlObj[] = Array.isArray(rawStyles) ? rawStyles : (rawStyles ? [rawStyles] : []);

        let normalRun: RunProps = { fontFamily: null, fontSize: null, color: null };
        let normalPara: ParaProps = { lineHeight: null, spaceBefore: null, spaceAfter: null };
        let h1Run: RunProps = { fontFamily: null, fontSize: null, color: null };
        let h2Run: RunProps = { fontFamily: null, fontSize: null, color: null };

        for (const style of styleList) {
            const styleId = attr(style, 'w:styleId') as string | undefined;
            if (!styleId) continue;

            const rPr = child(style, 'w:rPr');
            const pPr = child(style, 'w:pPr');

            if (styleId === 'Normal' || styleId === 'normal') {
                normalRun = extractRunProps(rPr, themeData);
                normalPara = extractParaProps(pPr);
            } else if (styleId === 'Heading1' || styleId === 'heading1') {
                h1Run = extractRunProps(rPr, themeData);
            } else if (styleId === 'Heading2' || styleId === 'heading2') {
                h2Run = extractRunProps(rPr, themeData);
            }
        }

        // 3. Build brand — priority: Named style > Document defaults
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
        };
    } catch (err) {
        console.error('[extractBrandFromDocx] Failed:', err);
        return { ...EMPTY };
    }
}

/**
 * Deterministic Brand Extraction
 *
 * Attempts to extract company brand typography rules from a raw JSON string
 * by searching common token structures. No AI needed when the JSON has
 * well-known keys (brand, typography, styles, tokens, theme, etc.).
 */

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface BrandTypography {
    fontFamily: string | null;
    fontSize: number | null;
    lineHeight: number | null;
    spaceBefore: number | null;
    spaceAfter: number | null;
    h1Color: string | null;
    h2Color: string | null;
    bodyColor: string | null;
}

const EMPTY_BRAND: BrandTypography = {
    fontFamily: null,
    fontSize: null,
    lineHeight: null,
    spaceBefore: null,
    spaceAfter: null,
    h1Color: null,
    h2Color: null,
    bodyColor: null,
};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function isHexColor(v: unknown): v is string {
    return typeof v === 'string' && /^#([0-9a-fA-F]{3,8})$/.test(v);
}

function isRgbColor(v: unknown): v is string {
    return typeof v === 'string' && /^rgb/i.test(v);
}

function isColor(v: unknown): v is string {
    return isHexColor(v) || isRgbColor(v);
}

function toNumber(v: unknown): number | null {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = parseFloat(v);
        if (isFinite(n)) return n;
    }
    return null;
}

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0;
}

export function validateBrand(raw: unknown): BrandTypography {
    if (!raw || typeof raw !== 'object') return { ...EMPTY_BRAND };

    const obj = raw as Record<string, unknown>;
    return {
        fontFamily: isNonEmptyString(obj.fontFamily) ? obj.fontFamily.trim() : null,
        fontSize: toNumber(obj.fontSize),
        lineHeight: toNumber(obj.lineHeight),
        spaceBefore: toNumber(obj.spaceBefore),
        spaceAfter: toNumber(obj.spaceAfter),
        h1Color: isColor(obj.h1Color) ? obj.h1Color : null,
        h2Color: isColor(obj.h2Color) ? obj.h2Color : null,
        bodyColor: isColor(obj.bodyColor) ? obj.bodyColor : null,
    };
}

/** True when at least 2 non-null fields are present */
export function hasMeaningfulFields(b: BrandTypography): boolean {
    let count = 0;
    if (b.fontFamily) count++;
    if (b.fontSize !== null) count++;
    if (b.lineHeight !== null) count++;
    if (b.spaceBefore !== null) count++;
    if (b.spaceAfter !== null) count++;
    if (b.h1Color) count++;
    if (b.h2Color) count++;
    if (b.bodyColor) count++;
    return count >= 2;
}

// ---------------------------------------------------------------------------
// Deep search helpers
// ---------------------------------------------------------------------------

/**
 * Keys we look for at any nesting depth to find the typography subtree.
 * Once found we mine that subtree for specific token values.
 */
const SECTION_KEYS = [
    'brand', 'typography', 'styles', 'tokens', 'theme',
    'fonts', 'type', 'text', 'design', 'designTokens',
];

const FONT_KEYS = ['fontFamily', 'font', 'typeface', 'font-family', 'fontName', 'family'];
const SIZE_KEYS = ['fontSize', 'size', 'font-size', 'textSize', 'baseSize'];
const LH_KEYS = ['lineHeight', 'leading', 'line-height', 'lineSpacing'];
const SPACE_BEFORE_KEYS = ['spaceBefore', 'marginTop', 'margin-top', 'paddingTop'];
const SPACE_AFTER_KEYS = ['spaceAfter', 'marginBottom', 'margin-bottom', 'paddingBottom'];

const H1_COLOR_KEYS = ['h1Color', 'h1', 'heading1Color', 'titleColor', 'title'];
const H2_COLOR_KEYS = ['h2Color', 'h2', 'heading2Color', 'subtitleColor', 'subtitle'];
const BODY_COLOR_KEYS = ['bodyColor', 'body', 'textColor', 'text', 'foreground', 'color', 'paragraphColor'];

type AnyObj = Record<string, unknown>;

/** Search `obj` for the first key in `keys` that yields a satisfying value. */
function findString(obj: AnyObj, keys: string[]): string | null {
    for (const k of keys) {
        const v = obj[k];
        if (isNonEmptyString(v)) return v.trim();
        // Check nested .value pattern (design tokens)
        if (v && typeof v === 'object' && isNonEmptyString((v as AnyObj).value)) {
            return ((v as AnyObj).value as string).trim();
        }
    }
    return null;
}

function findNumber(obj: AnyObj, keys: string[]): number | null {
    for (const k of keys) {
        const v = obj[k];
        const n = toNumber(v);
        if (n !== null) return n;
        if (v && typeof v === 'object') {
            const inner = toNumber((v as AnyObj).value);
            if (inner !== null) return inner;
        }
    }
    return null;
}

function findColor(obj: AnyObj, keys: string[]): string | null {
    for (const k of keys) {
        const v = obj[k];
        if (isColor(v)) return v;
        if (isNonEmptyString(v) && typeof v === 'string') {
            // Nested object with .color
            // noop — checked next
        }
        if (v && typeof v === 'object') {
            const inner = v as AnyObj;
            if (isColor(inner.color)) return inner.color as string;
            if (isColor(inner.value)) return inner.value as string;
        }
    }
    return null;
}

/** Mine a subtree for brand values. */
function mineSubtree(obj: AnyObj): BrandTypography {
    return {
        fontFamily: findString(obj, FONT_KEYS),
        fontSize: findNumber(obj, SIZE_KEYS),
        lineHeight: findNumber(obj, LH_KEYS),
        spaceBefore: findNumber(obj, SPACE_BEFORE_KEYS),
        spaceAfter: findNumber(obj, SPACE_AFTER_KEYS),
        h1Color: findColor(obj, H1_COLOR_KEYS),
        h2Color: findColor(obj, H2_COLOR_KEYS),
        bodyColor: findColor(obj, BODY_COLOR_KEYS),
    };
}

/** Merge b into a (a takes priority for non-null fields). */
function mergeBrand(a: BrandTypography, b: BrandTypography): BrandTypography {
    return {
        fontFamily: a.fontFamily ?? b.fontFamily,
        fontSize: a.fontSize ?? b.fontSize,
        lineHeight: a.lineHeight ?? b.lineHeight,
        spaceBefore: a.spaceBefore ?? b.spaceBefore,
        spaceAfter: a.spaceAfter ?? b.spaceAfter,
        h1Color: a.h1Color ?? b.h1Color,
        h2Color: a.h2Color ?? b.h2Color,
        bodyColor: a.bodyColor ?? b.bodyColor,
    };
}

/**
 * Walk the JSON tree up to 4 levels deep, mining each SECTION_KEY subtree
 * we encounter, and also the root itself.
 */
function walkAndExtract(obj: unknown, depth: number): BrandTypography {
    if (depth > 4 || !obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return { ...EMPTY_BRAND };
    }

    const record = obj as AnyObj;
    let result = mineSubtree(record);

    for (const key of Object.keys(record)) {
        const child = record[key];
        if (!child || typeof child !== 'object' || Array.isArray(child)) continue;

        if (SECTION_KEYS.includes(key.toLowerCase()) || SECTION_KEYS.includes(key)) {
            const extracted = mineSubtree(child as AnyObj);
            result = mergeBrand(result, extracted);
        }

        // Recurse
        const deeper = walkAndExtract(child, depth + 1);
        result = mergeBrand(result, deeper);
    }

    return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Try to deterministically extract brand typography from raw JSON.
 * Returns a BrandTypography with null for any field not found.
 */
export function extractBrandFromJson(rawJsonString: string): BrandTypography {
    try {
        const parsed = JSON.parse(rawJsonString);
        return walkAndExtract(parsed, 0);
    } catch {
        return { ...EMPTY_BRAND };
    }
}

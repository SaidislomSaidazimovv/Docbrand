/**
 * Header/Footer Store - Zustand with Persist
 * 
 * Complete header and footer management:
 * - Company branding (name, logo)
 * - Document title
 * - Position alignment
 * - Font and color customization
 * - Footer with page numbers, date
 * - Templates
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Alignment = 'left' | 'center' | 'right';
export type Distribution = 'gap' | 'space-between' | 'space-around';

export interface ElementStyle {
    color: string;
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
}

export const defaultElementStyle: ElementStyle = {
    color: '#000000',
    fontSize: 12,
    fontFamily: 'Inter',
    bold: false,
    italic: false,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
};

export interface HeaderConfig {
    companyName: string;
    documentTitle: string;
    logoUrl: string;
    logoFile: string | null; // Base64 for uploaded file
    showLogo: boolean;
    alignment: Alignment;
    fontFamily: string;
    fontSize: number;
    textColor: string;
    backgroundColor: string;
    showBorder: boolean;
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    elementGap: number;
    companyNameStyle: ElementStyle;
    documentTitleStyle: ElementStyle;
    distribution: Distribution;
    direction: 'row' | 'column';
    elementOrder: string[];
}

export interface FooterConfig {
    text: string;
    showPageNumbers: boolean;
    pageNumberFormat: 'number' | 'pageOf'; // "1" or "Page 1 of 10"
    showDate: boolean;
    dateFormat: 'short' | 'long' | 'iso'; // "Jan 15, 2026" or "January 15, 2026" or "2026-01-15"
    alignment: Alignment;
    fontFamily: string;
    fontSize: number;
    textColor: string;
    showBorder: boolean;
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    elementGap: number;
    textStyle: ElementStyle;
    dateStyle: ElementStyle;
    pageNumberStyle: ElementStyle;
    distribution: Distribution;
    direction: 'row' | 'column';
    elementOrder: string[];
}

export interface Template {
    id: string;
    name: string;
    header: Partial<HeaderConfig>;
    footer: Partial<FooterConfig>;
}

interface HeaderFooterState {
    header: HeaderConfig;
    footer: FooterConfig;
    activeTemplate: string | null;

    // Actions
    updateHeader: (data: Partial<HeaderConfig>) => void;
    updateFooter: (data: Partial<FooterConfig>) => void;
    updateHeaderElementStyle: (element: 'companyName' | 'documentTitle', style: Partial<ElementStyle>) => void;
    updateFooterElementStyle: (element: 'text' | 'date' | 'pageNumber', style: Partial<ElementStyle>) => void;
    reorderHeaderElements: (order: string[]) => void;
    reorderFooterElements: (order: string[]) => void;
    applyTemplate: (template: Template) => void;
    reset: () => void;
}

const defaultHeader: HeaderConfig = {
    companyName: '',
    documentTitle: '',
    logoUrl: '',
    logoFile: null,
    showLogo: false,
    alignment: 'left',
    fontFamily: 'Inter',
    fontSize: 12,
    textColor: '#000000',
    backgroundColor: 'transparent',
    showBorder: false,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 64,
    paddingRight: 64,
    elementGap: 16,
    companyNameStyle: { ...defaultElementStyle, fontSize: 14, bold: true },
    documentTitleStyle: { ...defaultElementStyle, fontSize: 12 },
    distribution: 'gap',
    direction: 'row',
    elementOrder: ['logo', 'companyName', 'documentTitle'],
};

const defaultFooter: FooterConfig = {
    text: '',
    showPageNumbers: false,
    pageNumberFormat: 'pageOf',
    showDate: false,
    dateFormat: 'long',
    alignment: 'center',
    fontFamily: 'Inter',
    fontSize: 12,
    textColor: '#6b7280',
    showBorder: true,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 64,
    paddingRight: 64,
    elementGap: 24,
    textStyle: { ...defaultElementStyle, fontSize: 11 },
    dateStyle: { ...defaultElementStyle, fontSize: 11 },
    pageNumberStyle: { ...defaultElementStyle, fontSize: 11 },
    distribution: 'gap',
    direction: 'row',
    elementOrder: ['text', 'date', 'pageNumber'],
};

// Pre-built templates
export const TEMPLATES: Template[] = [
    {
        id: 'professional',
        name: 'Professional',
        header: {
            alignment: 'left',
            showLogo: true,
            showBorder: true,
            textColor: '#1f2937',
        },
        footer: {
            alignment: 'center',
            showPageNumbers: true,
            pageNumberFormat: 'pageOf',
            showDate: true,
            showBorder: true,
        },
    },
    {
        id: 'minimal',
        name: 'Minimal',
        header: {
            alignment: 'center',
            showLogo: false,
            showBorder: false,
            textColor: '#6b7280',
        },
        footer: {
            alignment: 'right',
            showPageNumbers: true,
            pageNumberFormat: 'number',
            showDate: false,
            showBorder: false,
        },
    },
    {
        id: 'corporate',
        name: 'Corporate',
        header: {
            alignment: 'left',
            showLogo: true,
            showBorder: true,
            backgroundColor: '#f3f4f6',
            textColor: '#111827',
        },
        footer: {
            alignment: 'left',
            showPageNumbers: true,
            pageNumberFormat: 'pageOf',
            showDate: true,
            dateFormat: 'long',
            showBorder: true,
        },
    },
    {
        id: 'government',
        name: 'Government',
        header: {
            alignment: 'center',
            showLogo: true,
            showBorder: true,
            textColor: '#1e3a5f',
        },
        footer: {
            text: 'CONTROLLED UNCLASSIFIED INFORMATION',
            alignment: 'center',
            showPageNumbers: true,
            showDate: true,
            showBorder: true,
            textColor: '#dc2626',
        },
    },
];

export const useHeaderFooterStore = create<HeaderFooterState>()(
    persist(
        (set) => ({
            header: defaultHeader,
            footer: defaultFooter,
            activeTemplate: null,

            updateHeader: (data) =>
                set((state) => ({
                    header: { ...state.header, ...data },
                    activeTemplate: null, // Custom changes clear template
                })),

            updateFooter: (data) =>
                set((state) => ({
                    footer: { ...state.footer, ...data },
                    activeTemplate: null,
                })),

            updateHeaderElementStyle: (element, style) =>
                set((state) => {
                    const key = element === 'companyName' ? 'companyNameStyle' : 'documentTitleStyle';
                    return {
                        header: {
                            ...state.header,
                            [key]: { ...state.header[key], ...style },
                        },
                        activeTemplate: null,
                    };
                }),

            updateFooterElementStyle: (element, style) =>
                set((state) => {
                    const key = element === 'text' ? 'textStyle'
                        : element === 'date' ? 'dateStyle' : 'pageNumberStyle';
                    return {
                        footer: {
                            ...state.footer,
                            [key]: { ...state.footer[key], ...style },
                        },
                        activeTemplate: null,
                    };
                }),

            reorderHeaderElements: (order) =>
                set((state) => ({
                    header: { ...state.header, elementOrder: order },
                    activeTemplate: null,
                })),

            reorderFooterElements: (order) =>
                set((state) => ({
                    footer: { ...state.footer, elementOrder: order },
                    activeTemplate: null,
                })),

            applyTemplate: (template) =>
                set((state) => ({
                    header: { ...state.header, ...template.header },
                    footer: { ...state.footer, ...template.footer },
                    activeTemplate: template.id,
                })),

            reset: () =>
                set({
                    header: defaultHeader,
                    footer: defaultFooter,
                    activeTemplate: null,
                }),
        }),
        {
            name: 'docbrand-header-footer',
            version: 5,
            migrate: (persisted: unknown, version: number) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let state = persisted as any;
                if (version < 2) {
                    // Stage 17 added per-element styles, distribution, elementOrder
                    const h = state?.header || {};
                    const f = state?.footer || {};
                    state = {
                        ...state,
                        header: {
                            ...defaultHeader,
                            ...h,
                            companyNameStyle: h.companyNameStyle ?? defaultHeader.companyNameStyle,
                            documentTitleStyle: h.documentTitleStyle ?? defaultHeader.documentTitleStyle,
                            distribution: h.distribution ?? 'gap',
                            elementOrder: h.elementOrder ?? defaultHeader.elementOrder,
                        },
                        footer: {
                            ...defaultFooter,
                            ...f,
                            textStyle: f.textStyle ?? defaultFooter.textStyle,
                            dateStyle: f.dateStyle ?? defaultFooter.dateStyle,
                            pageNumberStyle: f.pageNumberStyle ?? defaultFooter.pageNumberStyle,
                            distribution: f.distribution ?? 'gap',
                            elementOrder: f.elementOrder ?? defaultFooter.elementOrder,
                        },
                    };
                }
                if (version < 3) {
                    // Added direction field for row/column layout
                    state = {
                        ...state,
                        header: {
                            ...state.header,
                            direction: state.header?.direction ?? 'row',
                        },
                        footer: {
                            ...state.footer,
                            direction: state.footer?.direction ?? 'row',
                        },
                    };
                }
                if (version < 4) {
                    // Added per-element margin fields
                    const addMargins = (s: Record<string, unknown>) => ({
                        ...s,
                        marginTop: s?.marginTop ?? 0,
                        marginBottom: s?.marginBottom ?? 0,
                        marginLeft: s?.marginLeft ?? 0,
                        marginRight: s?.marginRight ?? 0,
                    });
                    const h = state.header;
                    const f = state.footer;
                    state = {
                        ...state,
                        header: {
                            ...h,
                            companyNameStyle: addMargins(h?.companyNameStyle || {}),
                            documentTitleStyle: addMargins(h?.documentTitleStyle || {}),
                        },
                        footer: {
                            ...f,
                            textStyle: addMargins(f?.textStyle || {}),
                            dateStyle: addMargins(f?.dateStyle || {}),
                            pageNumberStyle: addMargins(f?.pageNumberStyle || {}),
                        },
                    };
                }
                if (version < 5) {
                    // Fix: old default element color was #374151 (gray) — update to #000000 (black)
                    const fixColor = (s: Record<string, unknown>) => ({
                        ...s,
                        color: s?.color === '#374151' ? '#000000' : (s?.color ?? '#000000'),
                    });
                    const h = state.header;
                    const f = state.footer;
                    state = {
                        ...state,
                        header: {
                            ...h,
                            textColor: h?.textColor === '#374151' ? '#000000' : (h?.textColor ?? '#000000'),
                            companyNameStyle: fixColor(h?.companyNameStyle || {}),
                            documentTitleStyle: fixColor(h?.documentTitleStyle || {}),
                        },
                        footer: {
                            ...f,
                            textStyle: fixColor(f?.textStyle || {}),
                            dateStyle: fixColor(f?.dateStyle || {}),
                            pageNumberStyle: fixColor(f?.pageNumberStyle || {}),
                        },
                    };
                }
                return state;
            },
        }
    )
);

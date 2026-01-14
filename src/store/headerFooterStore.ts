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
    textColor: '#374151',
    backgroundColor: 'transparent',
    showBorder: false,
};

const defaultFooter: FooterConfig = {
    text: 'Confidential',
    showPageNumbers: true,
    pageNumberFormat: 'pageOf',
    showDate: true,
    dateFormat: 'long',
    alignment: 'center',
    fontFamily: 'Inter',
    fontSize: 10,
    textColor: '#6b7280',
    showBorder: true,
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
        }
    )
);

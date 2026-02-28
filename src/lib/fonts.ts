/**
 * Font configuration for DocBrand
 *
 * Central registry of available fonts. System fonts rely on OS availability;
 * Google Fonts are loaded via <link> in layout.tsx.
 */

export interface FontEntry {
    name: string;
    category: 'serif' | 'sans-serif';
    system: boolean;
}

export const AVAILABLE_FONTS: FontEntry[] = [
    // System fonts
    { name: 'Arial', category: 'sans-serif', system: true },
    { name: 'Times New Roman', category: 'serif', system: true },
    { name: 'Georgia', category: 'serif', system: true },
    { name: 'Calibri', category: 'sans-serif', system: true },
    // Google Fonts
    { name: 'Inter', category: 'sans-serif', system: false },
    { name: 'Roboto', category: 'sans-serif', system: false },
    { name: 'Open Sans', category: 'sans-serif', system: false },
    { name: 'Lato', category: 'sans-serif', system: false },
    { name: 'Poppins', category: 'sans-serif', system: false },
    { name: 'Montserrat', category: 'sans-serif', system: false },
    { name: 'Merriweather', category: 'serif', system: false },
    { name: 'Playfair Display', category: 'serif', system: false },
    { name: 'Nunito', category: 'sans-serif', system: false },
    { name: 'Raleway', category: 'sans-serif', system: false },
    { name: 'Oswald', category: 'sans-serif', system: false },
    { name: 'PT Serif', category: 'serif', system: false },
    { name: 'Libre Baskerville', category: 'serif', system: false },
    { name: 'EB Garamond', category: 'serif', system: false },
    { name: 'Ubuntu', category: 'sans-serif', system: false },
    { name: 'Work Sans', category: 'sans-serif', system: false },
];

/** GovCon-compliant fonts allowed in DOCX export */
export const GOVCON_FONTS = ['Times New Roman', 'Arial', 'Calibri'];

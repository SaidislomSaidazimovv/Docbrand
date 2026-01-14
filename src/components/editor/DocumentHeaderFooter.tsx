'use client';

import { useHeaderFooterStore } from '@/store/headerFooterStore';

/**
 * DocumentHeader - Displays header on the document based on store settings
 */
export function DocumentHeader() {
    const { header } = useHeaderFooterStore();

    const logoSrc = header.logoFile || header.logoUrl;
    const hasContent = header.companyName || header.documentTitle || (header.showLogo && logoSrc);

    if (!hasContent) {
        return null;
    }

    return (
        <div
            className={`px-16 py-4 ${header.showBorder ? 'border-b border-gray-200' : ''}`}
            style={{
                backgroundColor: header.backgroundColor,
                textAlign: header.alignment,
            }}
        >
            <div className={`flex items-center gap-4 ${header.alignment === 'center' ? 'justify-center' :
                    header.alignment === 'right' ? 'justify-end' : 'justify-start'
                }`}>
                {header.showLogo && logoSrc && (
                    <img
                        src={logoSrc}
                        alt="Company Logo"
                        className="h-10 w-auto object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                )}
                <div>
                    {header.companyName && (
                        <p
                            style={{
                                fontFamily: header.fontFamily,
                                fontSize: header.fontSize + 2,
                                color: header.textColor,
                            }}
                            className="font-semibold"
                        >
                            {header.companyName}
                        </p>
                    )}
                    {header.documentTitle && (
                        <p
                            style={{
                                fontFamily: header.fontFamily,
                                fontSize: header.fontSize,
                                color: header.textColor,
                            }}
                            className="opacity-80"
                        >
                            {header.documentTitle}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * DocumentFooter - Displays footer on the document based on store settings
 */
export function DocumentFooter() {
    const { footer } = useHeaderFooterStore();

    // Format date based on setting
    const formatDate = (format: 'short' | 'long' | 'iso') => {
        const date = new Date();
        switch (format) {
            case 'short':
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            case 'long':
                return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            case 'iso':
                return date.toISOString().split('T')[0];
        }
    };

    const hasContent = footer.text || footer.showPageNumbers || footer.showDate;

    if (!hasContent) {
        return null;
    }

    return (
        <div
            className={`px-16 py-3 ${footer.showBorder ? 'border-t border-gray-200' : ''}`}
            style={{ textAlign: footer.alignment }}
        >
            <div className={`flex items-center gap-6 ${footer.alignment === 'center' ? 'justify-center' :
                    footer.alignment === 'right' ? 'justify-end' : 'justify-start'
                }`}>
                {footer.text && (
                    <span
                        style={{
                            fontFamily: footer.fontFamily,
                            fontSize: footer.fontSize,
                            color: footer.textColor
                        }}
                    >
                        {footer.text}
                    </span>
                )}
                {footer.showDate && (
                    <span
                        style={{
                            fontFamily: footer.fontFamily,
                            fontSize: footer.fontSize,
                            color: footer.textColor
                        }}
                    >
                        {formatDate(footer.dateFormat)}
                    </span>
                )}
                {footer.showPageNumbers && (
                    <span
                        style={{
                            fontFamily: footer.fontFamily,
                            fontSize: footer.fontSize,
                            color: footer.textColor
                        }}
                    >
                        {footer.pageNumberFormat === 'pageOf' ? 'Page 1 of 10' : '1'}
                    </span>
                )}
            </div>
        </div>
    );
}

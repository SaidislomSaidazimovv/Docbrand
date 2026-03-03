'use client';

import { useHeaderFooterStore } from '@/store/headerFooterStore';
import { ReactNode } from 'react';

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

    const headerDir = header.direction ?? 'row';
    const distribution = header.distribution ?? 'gap';
    const justify = headerDir === 'column'
        ? 'flex-start'
        : distribution === 'gap'
            ? (header.alignment === 'center' ? 'center' : header.alignment === 'right' ? 'flex-end' : 'flex-start')
            : distribution;

    // Render element by key
    const renderElement = (key: string): ReactNode => {
        if (key === 'logo' && header.showLogo && logoSrc) {
            return (
                <img
                    key="logo"
                    src={logoSrc}
                    alt="Company Logo"
                    className="h-10 w-auto object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                />
            );
        }
        if (key === 'companyName' && header.companyName) {
            const s = header.companyNameStyle;
            return (
                <p
                    key="companyName"
                    style={{
                        fontFamily: s?.fontFamily || header.fontFamily,
                        fontSize: s?.fontSize || (header.fontSize + 2),
                        color: s?.color || header.textColor,
                        fontWeight: s?.bold ? 'bold' : 'normal',
                        fontStyle: s?.italic ? 'italic' : 'normal',
                        marginTop: `${s?.marginTop || 0}px`,
                        marginBottom: `${s?.marginBottom || 0}px`,
                        marginLeft: `${s?.marginLeft || 0}px`,
                        marginRight: `${s?.marginRight || 0}px`,
                    }}
                >
                    {header.companyName}
                </p>
            );
        }
        if (key === 'documentTitle' && header.documentTitle) {
            const s = header.documentTitleStyle;
            return (
                <p
                    key="documentTitle"
                    style={{
                        fontFamily: s?.fontFamily || header.fontFamily,
                        fontSize: s?.fontSize || header.fontSize,
                        color: s?.color || header.textColor,
                        fontWeight: s?.bold ? 'bold' : 'normal',
                        fontStyle: s?.italic ? 'italic' : 'normal',
                        marginTop: `${s?.marginTop || 0}px`,
                        marginBottom: `${s?.marginBottom || 0}px`,
                        marginLeft: `${s?.marginLeft || 0}px`,
                        marginRight: `${s?.marginRight || 0}px`,
                    }}
                >
                    {header.documentTitle}
                </p>
            );
        }
        return null;
    };

    const elementOrder = header.elementOrder ?? ['logo', 'companyName', 'documentTitle'];

    return (
        <div
            className={`${header.showBorder ? 'border-b border-gray-200' : ''}`}
            style={{
                backgroundColor: header.backgroundColor,
                textAlign: header.alignment,
                paddingTop: `${header.paddingTop ?? 16}px`,
                paddingBottom: `${header.paddingBottom ?? 16}px`,
                paddingLeft: `${header.paddingLeft ?? 64}px`,
                paddingRight: `${header.paddingRight ?? 64}px`,
            }}
        >
            <div
                className="flex"
                style={{
                    flexDirection: headerDir,
                    gap: `${header.elementGap ?? 16}px`,
                    justifyContent: justify,
                    alignItems: headerDir === 'column' ? 'flex-start' : 'center',
                }}
            >
                {elementOrder.map((key) => renderElement(key))}
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

    const footerDir = footer.direction ?? 'row';
    const footerDistribution = footer.distribution ?? 'gap';
    const justify = footerDir === 'column'
        ? 'flex-start'
        : footerDistribution === 'gap'
            ? (footer.alignment === 'center' ? 'center' : footer.alignment === 'right' ? 'flex-end' : 'flex-start')
            : footerDistribution;

    // Render element by key
    const renderElement = (key: string): ReactNode => {
        if (key === 'text' && footer.text) {
            const s = footer.textStyle;
            return (
                <span
                    key="text"
                    style={{
                        fontFamily: s?.fontFamily || footer.fontFamily,
                        fontSize: s?.fontSize || footer.fontSize,
                        color: s?.color || footer.textColor,
                        fontWeight: s?.bold ? 'bold' : 'normal',
                        fontStyle: s?.italic ? 'italic' : 'normal',
                        marginTop: `${s?.marginTop || 0}px`,
                        marginBottom: `${s?.marginBottom || 0}px`,
                        marginLeft: `${s?.marginLeft || 0}px`,
                        marginRight: `${s?.marginRight || 0}px`,
                    }}
                >
                    {footer.text}
                </span>
            );
        }
        if (key === 'date' && footer.showDate) {
            const s = footer.dateStyle;
            return (
                <span
                    key="date"
                    style={{
                        fontFamily: s?.fontFamily || footer.fontFamily,
                        fontSize: s?.fontSize || footer.fontSize,
                        color: s?.color || footer.textColor,
                        fontWeight: s?.bold ? 'bold' : 'normal',
                        fontStyle: s?.italic ? 'italic' : 'normal',
                        marginTop: `${s?.marginTop || 0}px`,
                        marginBottom: `${s?.marginBottom || 0}px`,
                        marginLeft: `${s?.marginLeft || 0}px`,
                        marginRight: `${s?.marginRight || 0}px`,
                    }}
                >
                    {formatDate(footer.dateFormat)}
                </span>
            );
        }
        if (key === 'pageNumber' && footer.showPageNumbers) {
            const s = footer.pageNumberStyle;
            return (
                <span
                    key="pageNumber"
                    style={{
                        fontFamily: s?.fontFamily || footer.fontFamily,
                        fontSize: s?.fontSize || footer.fontSize,
                        color: s?.color || footer.textColor,
                        fontWeight: s?.bold ? 'bold' : 'normal',
                        fontStyle: s?.italic ? 'italic' : 'normal',
                        marginTop: `${s?.marginTop || 0}px`,
                        marginBottom: `${s?.marginBottom || 0}px`,
                        marginLeft: `${s?.marginLeft || 0}px`,
                        marginRight: `${s?.marginRight || 0}px`,
                    }}
                >
                    {footer.pageNumberFormat === 'pageOf' ? 'Page 1 of 10' : '1'}
                </span>
            );
        }
        return null;
    };

    const elementOrder = footer.elementOrder ?? ['text', 'date', 'pageNumber'];

    return (
        <div
            className={`${footer.showBorder ? 'border-t border-gray-200' : ''}`}
            style={{
                textAlign: footer.alignment,
                paddingTop: `${footer.paddingTop ?? 12}px`,
                paddingBottom: `${footer.paddingBottom ?? 12}px`,
                paddingLeft: `${footer.paddingLeft ?? 64}px`,
                paddingRight: `${footer.paddingRight ?? 64}px`,
            }}
        >
            <div
                className="flex"
                style={{
                    flexDirection: footerDir,
                    gap: `${footer.elementGap ?? 24}px`,
                    justifyContent: justify,
                    alignItems: footerDir === 'column' ? 'flex-start' : 'center',
                }}
            >
                {elementOrder.map((key) => renderElement(key))}
            </div>
        </div>
    );
}

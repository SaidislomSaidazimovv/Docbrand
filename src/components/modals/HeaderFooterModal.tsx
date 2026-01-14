'use client';

import { useState, useRef } from 'react';
import { X, Image, Building2, FileText, Calendar, Hash, Upload, AlignLeft, AlignCenter, AlignRight, Palette, Type, LayoutTemplate, Check, Eye } from 'lucide-react';
import { useHeaderFooterStore, TEMPLATES, Alignment, HeaderConfig, FooterConfig } from '@/store/headerFooterStore';

interface HeaderFooterModalProps {
    onClose: () => void;
}

type Tab = 'header' | 'footer' | 'templates';

// Alignment button component - defined outside to avoid recreation
interface AlignmentButtonsProps {
    value: Alignment;
    onChange: (v: Alignment) => void;
}

function AlignmentButtons({ value, onChange }: AlignmentButtonsProps) {
    return (
        <div className="flex rounded-lg overflow-hidden border border-[#30363d]">
            {(['left', 'center', 'right'] as Alignment[]).map((align) => (
                <button
                    key={align}
                    onClick={() => onChange(align)}
                    className={`p-2 transition-colors ${value === align ? 'bg-[#388bfd] text-white' : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'}`}
                >
                    {align === 'left' && <AlignLeft size={16} />}
                    {align === 'center' && <AlignCenter size={16} />}
                    {align === 'right' && <AlignRight size={16} />}
                </button>
            ))}
        </div>
    );
}

// Preview Component - defined outside to avoid recreation
interface PreviewProps {
    header: HeaderConfig;
    footer: FooterConfig;
}

function Preview({ header, footer }: PreviewProps) {
    const logoSrc = header.logoFile || header.logoUrl;

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

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Header Preview */}
            <div
                className={`p-4 border-b ${header.showBorder ? 'border-gray-300' : 'border-transparent'}`}
                style={{
                    backgroundColor: header.backgroundColor,
                    textAlign: header.alignment,
                }}
            >
                <div className={`flex items-center gap-3 ${header.alignment === 'center' ? 'justify-center' :
                        header.alignment === 'right' ? 'justify-end' : 'justify-start'
                    }`}>
                    {header.showLogo && logoSrc && (
                        <img
                            src={logoSrc}
                            alt="Logo"
                            className="h-8 w-auto object-contain"
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

            {/* Page Content Placeholder */}
            <div className="p-6 min-h-[100px] bg-gray-50">
                <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
            </div>

            {/* Footer Preview */}
            <div
                className={`p-3 border-t ${footer.showBorder ? 'border-gray-300' : 'border-transparent'}`}
                style={{ textAlign: footer.alignment }}
            >
                <div className={`flex items-center gap-4 text-xs ${footer.alignment === 'center' ? 'justify-center' :
                        footer.alignment === 'right' ? 'justify-end' : 'justify-start'
                    }`}>
                    {footer.text && (
                        <span style={{ fontFamily: footer.fontFamily, fontSize: footer.fontSize, color: footer.textColor }}>
                            {footer.text}
                        </span>
                    )}
                    {footer.showDate && (
                        <span style={{ fontFamily: footer.fontFamily, fontSize: footer.fontSize, color: footer.textColor }}>
                            {formatDate(footer.dateFormat)}
                        </span>
                    )}
                    {footer.showPageNumbers && (
                        <span style={{ fontFamily: footer.fontFamily, fontSize: footer.fontSize, color: footer.textColor }}>
                            {footer.pageNumberFormat === 'pageOf' ? 'Page 1 of 10' : '1'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper function for date formatting
function formatDate(format: 'short' | 'long' | 'iso') {
    const date = new Date();
    switch (format) {
        case 'short':
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        case 'long':
            return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        case 'iso':
            return date.toISOString().split('T')[0];
    }
}

export default function HeaderFooterModal({ onClose }: HeaderFooterModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('header');
    const [showPreview, setShowPreview] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { header, footer, activeTemplate, updateHeader, updateFooter, applyTemplate, reset } = useHeaderFooterStore();

    // Handle logo file upload
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            updateHeader({ logoFile: base64, showLogo: true });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] bg-[#161b22] rounded-xl shadow-2xl border border-[#30363d] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-[#c9d1d9]">Edit Header & Footer</h2>
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${showPreview ? 'bg-[#388bfd] text-white' : 'bg-[#21262d] text-[#8b949e]'
                                }`}
                        >
                            <Eye size={12} />
                            Preview
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-[#21262d] rounded transition-colors">
                        <X size={18} className="text-[#8b949e]" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#21262d]">
                    {(['header', 'footer', 'templates'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === tab
                                    ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                                    : 'text-[#8b949e] hover:text-[#c9d1d9]'
                                }`}
                        >
                            {tab === 'templates' && <LayoutTemplate size={14} />}
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className={`grid gap-6 ${showPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {/* Settings Panel */}
                        <div className="space-y-5">
                            {activeTab === 'header' && (
                                <>
                                    {/* Company Name */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            <Building2 size={14} />
                                            Company Name
                                        </label>
                                        <input
                                            type="text"
                                            value={header.companyName}
                                            onChange={(e) => updateHeader({ companyName: e.target.value })}
                                            className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                            placeholder="e.g., Acme Solutions Inc."
                                        />
                                    </div>

                                    {/* Document Title */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            <FileText size={14} />
                                            Document Title
                                        </label>
                                        <input
                                            type="text"
                                            value={header.documentTitle}
                                            onChange={(e) => updateHeader({ documentTitle: e.target.value })}
                                            className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                            placeholder="e.g., Technical Proposal - DOJ-2024-RFP-045"
                                        />
                                    </div>

                                    {/* Logo Section */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            <Image size={14} />
                                            Logo
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={header.logoUrl}
                                                onChange={(e) => updateHeader({ logoUrl: e.target.value })}
                                                className="flex-1 px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                                placeholder="Logo URL or upload file"
                                            />
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#388bfd] transition-colors"
                                            >
                                                <Upload size={16} />
                                            </button>
                                        </div>
                                        {header.logoFile && (
                                            <p className="text-xs text-[#3fb950] mt-1">✓ Logo uploaded</p>
                                        )}
                                    </div>

                                    {/* Alignment */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            Alignment
                                        </label>
                                        <AlignmentButtons
                                            value={header.alignment}
                                            onChange={(v) => updateHeader({ alignment: v })}
                                        />
                                    </div>

                                    {/* Font & Colors */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                                <Type size={14} />
                                                Font Size
                                            </label>
                                            <input
                                                type="number"
                                                value={header.fontSize}
                                                onChange={(e) => updateHeader({ fontSize: parseInt(e.target.value) || 12 })}
                                                className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                                min={8}
                                                max={24}
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                                <Palette size={14} />
                                                Text Color
                                            </label>
                                            <input
                                                type="color"
                                                value={header.textColor}
                                                onChange={(e) => updateHeader({ textColor: e.target.value })}
                                                className="w-full h-10 bg-[#21262d] border border-[#30363d] rounded-lg cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={header.showLogo}
                                                onChange={(e) => updateHeader({ showLogo: e.target.checked })}
                                                className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd]"
                                            />
                                            <span className="text-sm text-[#c9d1d9]">Show logo</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={header.showBorder}
                                                onChange={(e) => updateHeader({ showBorder: e.target.checked })}
                                                className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd]"
                                            />
                                            <span className="text-sm text-[#c9d1d9]">Show bottom border</span>
                                        </label>
                                    </div>
                                </>
                            )}

                            {activeTab === 'footer' && (
                                <>
                                    {/* Footer Text */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            <FileText size={14} />
                                            Footer Text
                                        </label>
                                        <input
                                            type="text"
                                            value={footer.text}
                                            onChange={(e) => updateFooter({ text: e.target.value })}
                                            className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                            placeholder="e.g., Confidential - Do Not Distribute"
                                        />
                                    </div>

                                    {/* Alignment */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            Alignment
                                        </label>
                                        <AlignmentButtons
                                            value={footer.alignment}
                                            onChange={(v) => updateFooter({ alignment: v })}
                                        />
                                    </div>

                                    {/* Page Numbers */}
                                    <div>
                                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                                            <input
                                                type="checkbox"
                                                checked={footer.showPageNumbers}
                                                onChange={(e) => updateFooter({ showPageNumbers: e.target.checked })}
                                                className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd]"
                                            />
                                            <Hash size={14} className="text-[#8b949e]" />
                                            <span className="text-sm text-[#c9d1d9]">Show page numbers</span>
                                        </label>
                                        {footer.showPageNumbers && (
                                            <select
                                                value={footer.pageNumberFormat}
                                                onChange={(e) => updateFooter({ pageNumberFormat: e.target.value as 'number' | 'pageOf' })}
                                                className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                            >
                                                <option value="number">Simple (1, 2, 3...)</option>
                                                <option value="pageOf">Full (Page 1 of 10)</option>
                                            </select>
                                        )}
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                                            <input
                                                type="checkbox"
                                                checked={footer.showDate}
                                                onChange={(e) => updateFooter({ showDate: e.target.checked })}
                                                className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd]"
                                            />
                                            <Calendar size={14} className="text-[#8b949e]" />
                                            <span className="text-sm text-[#c9d1d9]">Show date</span>
                                        </label>
                                        {footer.showDate && (
                                            <select
                                                value={footer.dateFormat}
                                                onChange={(e) => updateFooter({ dateFormat: e.target.value as 'short' | 'long' | 'iso' })}
                                                className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                            >
                                                <option value="short">{formatDate('short')}</option>
                                                <option value="long">{formatDate('long')}</option>
                                                <option value="iso">{formatDate('iso')}</option>
                                            </select>
                                        )}
                                    </div>

                                    {/* Font & Colors */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                                <Type size={14} />
                                                Font Size
                                            </label>
                                            <input
                                                type="number"
                                                value={footer.fontSize}
                                                onChange={(e) => updateFooter({ fontSize: parseInt(e.target.value) || 10 })}
                                                className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                                min={8}
                                                max={16}
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                                <Palette size={14} />
                                                Text Color
                                            </label>
                                            <input
                                                type="color"
                                                value={footer.textColor}
                                                onChange={(e) => updateFooter({ textColor: e.target.value })}
                                                className="w-full h-10 bg-[#21262d] border border-[#30363d] rounded-lg cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {/* Border */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={footer.showBorder}
                                            onChange={(e) => updateFooter({ showBorder: e.target.checked })}
                                            className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd]"
                                        />
                                        <span className="text-sm text-[#c9d1d9]">Show top border</span>
                                    </label>
                                </>
                            )}

                            {activeTab === 'templates' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {TEMPLATES.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => applyTemplate(template)}
                                            className={`p-4 rounded-lg border-2 text-left transition-all ${activeTemplate === template.id
                                                    ? 'border-[#388bfd] bg-[#388bfd22]'
                                                    : 'border-[#30363d] bg-[#21262d] hover:border-[#8b949e]'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-[#c9d1d9]">{template.name}</span>
                                                {activeTemplate === template.id && (
                                                    <Check size={16} className="text-[#388bfd]" />
                                                )}
                                            </div>
                                            <p className="text-xs text-[#8b949e]">
                                                {template.id === 'professional' && 'Clean corporate look with logo'}
                                                {template.id === 'minimal' && 'Simple and elegant'}
                                                {template.id === 'corporate' && 'Full branding package'}
                                                {template.id === 'government' && 'Federal compliance ready'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Preview Panel */}
                        {showPreview && (
                            <div>
                                <p className="text-xs text-[#8b949e] mb-3 uppercase tracking-wide">Live Preview</p>
                                <Preview header={header} footer={footer} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-[#30363d]">
                    <button
                        onClick={reset}
                        className="px-4 py-2 text-sm text-[#f85149] hover:text-[#ff7b72] transition-colors"
                    >
                        Reset to Default
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm text-white font-medium transition-colors"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

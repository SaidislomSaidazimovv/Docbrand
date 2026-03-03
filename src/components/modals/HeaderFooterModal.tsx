'use client';

import { useState, useRef, ReactNode } from 'react';
import { X, Image, Building2, FileText, Calendar, Hash, Upload, AlignLeft, AlignCenter, AlignRight, Palette, LayoutTemplate, Check, Eye, GripVertical } from 'lucide-react';
import { useHeaderFooterStore, TEMPLATES, Alignment, HeaderConfig, FooterConfig, ElementStyle, defaultElementStyle, Distribution } from '@/store/headerFooterStore';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface HeaderFooterModalProps {
    isOpen: boolean;
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

// Distribution toggle component
interface DistributionToggleProps {
    value: Distribution;
    onChange: (v: Distribution) => void;
}

function DistributionToggle({ value, onChange }: DistributionToggleProps) {
    return (
        <div>
            <p className="text-xs font-medium text-[#8b949e] uppercase tracking-wide mb-2">Distribution</p>
            <div className="flex gap-2">
                {([
                    { value: 'gap' as Distribution, label: 'Gap' },
                    { value: 'space-between' as Distribution, label: 'Space Between' },
                    { value: 'space-around' as Distribution, label: 'Space Around' },
                ]).map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`px-3 py-1 rounded text-xs transition-colors ${value === opt.value
                            ? 'bg-[#388bfd] text-white'
                            : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Spacing input component
interface SpacingInputProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
}

function SpacingInput({ label, value, onChange, min = 0, max = 120 }: SpacingInputProps) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs text-[#8b949e]">{label}</span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onChange(Math.max(min, value - 4))}
                    className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                >−</button>
                <span className="w-10 text-center text-xs text-[#c9d1d9]">
                    {value}px
                </span>
                <button
                    onClick={() => onChange(Math.min(max, value + 4))}
                    className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                >+</button>
            </div>
        </div>
    );
}

// Sortable preview element wrapper
interface SortablePreviewElementProps {
    id: string;
    children: ReactNode;
    onClick: () => void;
    isSelected: boolean;
}

function SortablePreviewElement({ id, children, onClick, isSelected }: SortablePreviewElementProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                cursor: 'grab',
                outline: isSelected ? '2px solid #388bfd' : '1px dashed transparent',
                outlineOffset: '2px',
                borderRadius: '4px',
                padding: '2px 4px',
                opacity: isDragging ? 0.5 : 1,
                position: 'relative',
            }}
            {...attributes}
            {...listeners}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className="hover:outline-[#30363d] hover:outline-dashed hover:outline-1"
        >
            {children}
        </div>
    );
}

// Per-element style editor panel
interface ElementStyleEditorProps {
    label: string;
    style: ElementStyle;
    onChange: (style: Partial<ElementStyle>) => void;
    onClose: () => void;
}

function ElementStyleEditor({ label, style, onChange, onClose }: ElementStyleEditorProps) {
    return (
        <div className="mt-3 p-3 bg-[#161b22] rounded-lg border border-[#30363d]">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#8b949e] uppercase tracking-wide">
                    Style: {label}
                </p>
                <button
                    onClick={onClose}
                    className="p-0.5 hover:bg-[#21262d] rounded transition-colors"
                >
                    <X size={12} className="text-[#8b949e]" />
                </button>
            </div>

            {/* Font size */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8b949e]">Size</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onChange({ fontSize: Math.max(8, style.fontSize - 1) })}
                        className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                    >−</button>
                    <span className="text-xs text-[#c9d1d9] w-10 text-center">
                        {style.fontSize}px
                    </span>
                    <button
                        onClick={() => onChange({ fontSize: Math.min(32, style.fontSize + 1) })}
                        className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                    >+</button>
                </div>
            </div>

            {/* Color */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8b949e]">Color</span>
                <input
                    type="color"
                    value={style.color}
                    onChange={(e) => onChange({ color: e.target.value })}
                    className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
            </div>

            {/* Bold + Italic */}
            <div className="flex gap-2">
                <button
                    onClick={() => onChange({ bold: !style.bold })}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${style.bold
                        ? 'bg-[#388bfd] text-white'
                        : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                        }`}
                >
                    B
                </button>
                <button
                    onClick={() => onChange({ italic: !style.italic })}
                    className={`px-3 py-1 rounded text-xs italic transition-colors ${style.italic
                        ? 'bg-[#388bfd] text-white'
                        : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                        }`}
                >
                    I
                </button>
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

// Preview Component with drag-to-reorder and per-element click
interface PreviewProps {
    header: HeaderConfig;
    footer: FooterConfig;
    selectedElement: string | null;
    onSelectElement: (key: string | null) => void;
    onHeaderDragEnd: (event: DragEndEvent) => void;
    onFooterDragEnd: (event: DragEndEvent) => void;
}

function Preview({ header, footer, selectedElement, onSelectElement, onHeaderDragEnd, onFooterDragEnd }: PreviewProps) {
    const logoSrc = header.logoFile || header.logoUrl;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const headerDir = header.direction ?? 'row';
    const headerJustify = headerDir === 'column'
        ? 'flex-start'
        : header.distribution === 'gap'
            ? (header.alignment === 'center' ? 'center' : header.alignment === 'right' ? 'flex-end' : 'flex-start')
            : header.distribution;

    const footerDir = footer.direction ?? 'row';
    const footerJustify = footerDir === 'column'
        ? 'flex-start'
        : footer.distribution === 'gap'
            ? (footer.alignment === 'center' ? 'center' : footer.alignment === 'right' ? 'flex-end' : 'flex-start')
            : footer.distribution;

    // Render a header element by key
    const renderHeaderElement = (key: string) => {
        if (key === 'logo' && header.showLogo && logoSrc) {
            return (
                <SortablePreviewElement
                    key="logo"
                    id="logo"
                    isSelected={selectedElement === 'logo'}
                    onClick={() => onSelectElement('logo')}
                >
                    <img
                        src={logoSrc}
                        alt="Logo"
                        className="h-8 w-auto object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                </SortablePreviewElement>
            );
        }
        if (key === 'companyName' && header.companyName) {
            const s = header.companyNameStyle;
            return (
                <SortablePreviewElement
                    key="companyName"
                    id="companyName"
                    isSelected={selectedElement === 'companyName'}
                    onClick={() => onSelectElement('companyName')}
                >
                    <p style={{
                        fontFamily: s.fontFamily,
                        fontSize: s.fontSize,
                        color: s.color,
                        fontWeight: s.bold ? 'bold' : 'normal',
                        fontStyle: s.italic ? 'italic' : 'normal',
                        marginTop: `${s.marginTop || 0}px`,
                        marginBottom: `${s.marginBottom || 0}px`,
                        marginLeft: `${s.marginLeft || 0}px`,
                        marginRight: `${s.marginRight || 0}px`,
                        lineHeight: 1.3,
                    }}>
                        {header.companyName}
                    </p>
                </SortablePreviewElement>
            );
        }
        if (key === 'documentTitle' && header.documentTitle) {
            const s = header.documentTitleStyle;
            return (
                <SortablePreviewElement
                    key="documentTitle"
                    id="documentTitle"
                    isSelected={selectedElement === 'documentTitle'}
                    onClick={() => onSelectElement('documentTitle')}
                >
                    <p style={{
                        fontFamily: s.fontFamily,
                        fontSize: s.fontSize,
                        color: s.color,
                        fontWeight: s.bold ? 'bold' : 'normal',
                        fontStyle: s.italic ? 'italic' : 'normal',
                        marginTop: `${s.marginTop || 0}px`,
                        marginBottom: `${s.marginBottom || 0}px`,
                        marginLeft: `${s.marginLeft || 0}px`,
                        marginRight: `${s.marginRight || 0}px`,
                        lineHeight: 1.3,
                    }}>
                        {header.documentTitle}
                    </p>
                </SortablePreviewElement>
            );
        }
        return null;
    };

    // Render a footer element by key
    const renderFooterElement = (key: string) => {
        if (key === 'text' && footer.text) {
            const s = footer.textStyle;
            return (
                <SortablePreviewElement
                    key="text"
                    id="text"
                    isSelected={selectedElement === 'text'}
                    onClick={() => onSelectElement('text')}
                >
                    <span style={{
                        fontFamily: s.fontFamily,
                        fontSize: s.fontSize,
                        color: s.color,
                        fontWeight: s.bold ? 'bold' : 'normal',
                        fontStyle: s.italic ? 'italic' : 'normal',
                        marginTop: `${s.marginTop || 0}px`,
                        marginBottom: `${s.marginBottom || 0}px`,
                        marginLeft: `${s.marginLeft || 0}px`,
                        marginRight: `${s.marginRight || 0}px`,
                    }}>
                        {footer.text}
                    </span>
                </SortablePreviewElement>
            );
        }
        if (key === 'date' && footer.showDate) {
            const s = footer.dateStyle;
            return (
                <SortablePreviewElement
                    key="date"
                    id="date"
                    isSelected={selectedElement === 'date'}
                    onClick={() => onSelectElement('date')}
                >
                    <span style={{
                        fontFamily: s.fontFamily,
                        fontSize: s.fontSize,
                        color: s.color,
                        fontWeight: s.bold ? 'bold' : 'normal',
                        fontStyle: s.italic ? 'italic' : 'normal',
                        marginTop: `${s.marginTop || 0}px`,
                        marginBottom: `${s.marginBottom || 0}px`,
                        marginLeft: `${s.marginLeft || 0}px`,
                        marginRight: `${s.marginRight || 0}px`,
                    }}>
                        {formatDate(footer.dateFormat)}
                    </span>
                </SortablePreviewElement>
            );
        }
        if (key === 'pageNumber' && footer.showPageNumbers) {
            const s = footer.pageNumberStyle;
            return (
                <SortablePreviewElement
                    key="pageNumber"
                    id="pageNumber"
                    isSelected={selectedElement === 'pageNumber'}
                    onClick={() => onSelectElement('pageNumber')}
                >
                    <span style={{
                        fontFamily: s.fontFamily,
                        fontSize: s.fontSize,
                        color: s.color,
                        fontWeight: s.bold ? 'bold' : 'normal',
                        fontStyle: s.italic ? 'italic' : 'normal',
                        marginTop: `${s.marginTop || 0}px`,
                        marginBottom: `${s.marginBottom || 0}px`,
                        marginLeft: `${s.marginLeft || 0}px`,
                        marginRight: `${s.marginRight || 0}px`,
                    }}>
                        {footer.pageNumberFormat === 'pageOf' ? 'Page 1 of 10' : '1'}
                    </span>
                </SortablePreviewElement>
            );
        }
        return null;
    };

    // Filter to only visible elements for sortable context
    const visibleHeaderIds = (header.elementOrder ?? ['logo', 'companyName', 'documentTitle']).filter((key) => {
        if (key === 'logo') return header.showLogo && logoSrc;
        if (key === 'companyName') return !!header.companyName;
        if (key === 'documentTitle') return !!header.documentTitle;
        return false;
    });

    const visibleFooterIds = (footer.elementOrder ?? ['text', 'date', 'pageNumber']).filter((key) => {
        if (key === 'text') return !!footer.text;
        if (key === 'date') return footer.showDate;
        if (key === 'pageNumber') return footer.showPageNumbers;
        return false;
    });

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" onClick={() => onSelectElement(null)}>
            {/* Header Preview */}
            <div
                className={`p-4 border-b ${header.showBorder ? 'border-gray-300' : 'border-transparent'}`}
                style={{
                    backgroundColor: header.backgroundColor,
                    textAlign: header.alignment,
                }}
            >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onHeaderDragEnd}>
                    <SortableContext items={visibleHeaderIds} strategy={horizontalListSortingStrategy}>
                        <div
                            className="flex"
                            style={{
                                flexDirection: headerDir,
                                gap: `${header.elementGap ?? 16}px`,
                                justifyContent: headerJustify,
                                alignItems: headerDir === 'column' ? 'flex-start' : 'center',
                            }}
                        >
                            {(header.elementOrder ?? ['logo', 'companyName', 'documentTitle']).map((key) => renderHeaderElement(key))}
                        </div>
                    </SortableContext>
                </DndContext>
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
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFooterDragEnd}>
                    <SortableContext items={visibleFooterIds} strategy={horizontalListSortingStrategy}>
                        <div
                            className="flex"
                            style={{
                                flexDirection: footerDir,
                                gap: `${footer.elementGap ?? 24}px`,
                                justifyContent: footerJustify,
                                alignItems: footerDir === 'column' ? 'flex-start' : 'center',
                            }}
                        >
                            {(footer.elementOrder ?? ['text', 'date', 'pageNumber']).map((key) => renderFooterElement(key))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}

export default function HeaderFooterModal({ isOpen, onClose }: HeaderFooterModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('header');
    const [showPreview, setShowPreview] = useState(true);
    const [selectedElement, setSelectedElement] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        header, footer, activeTemplate,
        updateHeader, updateFooter,
        updateHeaderElementStyle, updateFooterElementStyle,
        reorderHeaderElements, reorderFooterElements,
        applyTemplate, reset,
    } = useHeaderFooterStore();

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

    // Get element style for the selected element
    const getElementStyle = (key: string): ElementStyle => {
        if (key === 'companyName') return header.companyNameStyle ?? defaultElementStyle;
        if (key === 'documentTitle') return header.documentTitleStyle ?? defaultElementStyle;
        if (key === 'text') return footer.textStyle ?? defaultElementStyle;
        if (key === 'date') return footer.dateStyle ?? defaultElementStyle;
        if (key === 'pageNumber') return footer.pageNumberStyle ?? defaultElementStyle;
        return defaultElementStyle;
    };

    // Get human-readable label for element
    const getElementLabel = (key: string): string => {
        const labels: Record<string, string> = {
            logo: 'Logo',
            companyName: 'Company Name',
            documentTitle: 'Document Title',
            text: 'Footer Text',
            date: 'Date',
            pageNumber: 'Page Number',
        };
        return labels[key] || key;
    };

    // Update element style (routes to header or footer)
    const handleUpdateElementStyle = (key: string, style: Partial<ElementStyle>) => {
        if (key === 'companyName' || key === 'documentTitle') {
            updateHeaderElementStyle(key, style);
        } else if (key === 'text' || key === 'date' || key === 'pageNumber') {
            updateFooterElementStyle(key, style);
        }
    };

    // Header drag end
    const handleHeaderDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const order = header.elementOrder ?? ['logo', 'companyName', 'documentTitle'];
            const oldIndex = order.indexOf(active.id as string);
            const newIndex = order.indexOf(over.id as string);
            if (oldIndex !== -1 && newIndex !== -1) {
                reorderHeaderElements(arrayMove(order, oldIndex, newIndex));
            }
        }
    };

    // Footer drag end
    const handleFooterDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const order = footer.elementOrder ?? ['text', 'date', 'pageNumber'];
            const oldIndex = order.indexOf(active.id as string);
            const newIndex = order.indexOf(over.id as string);
            if (oldIndex !== -1 && newIndex !== -1) {
                reorderFooterElements(arrayMove(order, oldIndex, newIndex));
            }
        }
    };

    // Whether selected element can be styled (logo cannot)
    const canStyleElement = selectedElement && selectedElement !== 'logo';

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-overlay ${isOpen ? 'modal-open' : ''}`}>
            <div className="w-full max-w-4xl max-h-[90vh] bg-[#161b22] rounded-xl shadow-2xl border border-[#30363d] flex flex-col overflow-hidden modal-panel">
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
                            onClick={() => {
                                setActiveTab(tab);
                                setSelectedElement(null);
                            }}
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

                                    {/* Distribution */}
                                    <DistributionToggle
                                        value={header.distribution ?? 'gap'}
                                        onChange={(v) => updateHeader({ distribution: v })}
                                    />

                                    {/* Layout Direction */}
                                    <div>
                                        <p className="text-xs font-medium text-[#8b949e] uppercase tracking-wide mb-2">Layout</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateHeader({ direction: 'row' })}
                                                className={`px-3 py-1 rounded text-xs transition-colors ${(header.direction ?? 'row') === 'row'
                                                    ? 'bg-[#388bfd] text-white'
                                                    : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                                                    }`}
                                            >
                                                ← → Side by side
                                            </button>
                                            <button
                                                onClick={() => updateHeader({ direction: 'column' })}
                                                className={`px-3 py-1 rounded text-xs transition-colors ${header.direction === 'column'
                                                    ? 'bg-[#388bfd] text-white'
                                                    : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                                                    }`}
                                            >
                                                ↕ Stacked
                                            </button>
                                        </div>
                                    </div>

                                    {/* Element Style Selector */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            <Palette size={14} />
                                            Element Style
                                        </label>
                                        <select
                                            value={selectedElement ?? ''}
                                            onChange={(e) => setSelectedElement(e.target.value || null)}
                                            className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                        >
                                            <option value="">Select element to style...</option>
                                            <option value="companyName">Company Name</option>
                                            <option value="documentTitle">Document Title</option>
                                            <option value="logo" disabled>Logo (no text style)</option>
                                        </select>

                                        {selectedElement && selectedElement !== 'logo' && (activeTab === 'header') && (
                                            (() => {
                                                const elStyle = getElementStyle(selectedElement);
                                                return (
                                                    <div className="mt-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2">
                                                        {/* Font size */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-[#8b949e]">Size</span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleUpdateElementStyle(selectedElement, { fontSize: Math.max(8, elStyle.fontSize - 1) })}
                                                                    className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                >−</button>
                                                                <span className="text-xs text-[#c9d1d9] w-10 text-center">{elStyle.fontSize}px</span>
                                                                <button
                                                                    onClick={() => handleUpdateElementStyle(selectedElement, { fontSize: Math.min(32, elStyle.fontSize + 1) })}
                                                                    className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                >+</button>
                                                            </div>
                                                        </div>
                                                        {/* Color */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-[#8b949e]">Color</span>
                                                            <input
                                                                type="color"
                                                                value={elStyle.color}
                                                                onChange={(e) => handleUpdateElementStyle(selectedElement, { color: e.target.value })}
                                                                className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                                                            />
                                                        </div>
                                                        {/* Bold + Italic */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleUpdateElementStyle(selectedElement, { bold: !elStyle.bold })}
                                                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${elStyle.bold ? 'bg-[#388bfd] text-white' : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'}`}
                                                            >B</button>
                                                            <button
                                                                onClick={() => handleUpdateElementStyle(selectedElement, { italic: !elStyle.italic })}
                                                                className={`px-3 py-1 rounded text-xs italic transition-colors ${elStyle.italic ? 'bg-[#388bfd] text-white' : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'}`}
                                                            >I</button>
                                                        </div>
                                                        {/* Per-element spacing */}
                                                        <div className="border-t border-[#30363d] mt-3 pt-3">
                                                            <p className="text-xs text-[#8b949e] mb-2">Spacing</p>
                                                            {([
                                                                { label: 'Top', key: 'marginTop' as const },
                                                                { label: 'Bottom', key: 'marginBottom' as const },
                                                                { label: 'Left', key: 'marginLeft' as const },
                                                                { label: 'Right', key: 'marginRight' as const },
                                                            ]).map(({ label, key }) => (
                                                                <div key={key} className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs text-[#8b949e]">{label}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleUpdateElementStyle(selectedElement, { [key]: Math.max(0, (elStyle[key] || 0) - 4) })}
                                                                            className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                        >−</button>
                                                                        <span className="w-10 text-center text-xs text-[#c9d1d9]">{elStyle[key] || 0}px</span>
                                                                        <button
                                                                            onClick={() => handleUpdateElementStyle(selectedElement, { [key]: Math.min(120, (elStyle[key] || 0) + 4) })}
                                                                            className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                        >+</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        )}
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

                                    {/* Spacing */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-[#8b949e] uppercase tracking-wide">Spacing</p>
                                        <SpacingInput label="Element gap" value={header.elementGap ?? 16} onChange={(v) => updateHeader({ elementGap: v })} max={64} />
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

                                    {/* Distribution */}
                                    <DistributionToggle
                                        value={footer.distribution ?? 'gap'}
                                        onChange={(v) => updateFooter({ distribution: v })}
                                    />

                                    {/* Layout Direction */}
                                    <div>
                                        <p className="text-xs font-medium text-[#8b949e] uppercase tracking-wide mb-2">Layout</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateFooter({ direction: 'row' })}
                                                className={`px-3 py-1 rounded text-xs transition-colors ${(footer.direction ?? 'row') === 'row'
                                                    ? 'bg-[#388bfd] text-white'
                                                    : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                                                    }`}
                                            >
                                                ← → Side by side
                                            </button>
                                            <button
                                                onClick={() => updateFooter({ direction: 'column' })}
                                                className={`px-3 py-1 rounded text-xs transition-colors ${footer.direction === 'column'
                                                    ? 'bg-[#388bfd] text-white'
                                                    : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                                                    }`}
                                            >
                                                ↕ Stacked
                                            </button>
                                        </div>
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

                                    {/* Element Style Selector */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                            <Palette size={14} />
                                            Element Style
                                        </label>
                                        <select
                                            value={selectedElement ?? ''}
                                            onChange={(e) => setSelectedElement(e.target.value || null)}
                                            className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                        >
                                            <option value="">Select element to style...</option>
                                            {footer.text && <option value="text">Footer Text</option>}
                                            {footer.showDate && <option value="date">Date</option>}
                                            {footer.showPageNumbers && <option value="pageNumber">Page Number</option>}
                                        </select>

                                        {selectedElement && selectedElement !== 'logo' && (activeTab === 'footer') && (
                                            (() => {
                                                const elStyle = getElementStyle(selectedElement);
                                                return (
                                                    <div className="mt-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2">
                                                        {/* Font size */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-[#8b949e]">Size</span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleUpdateElementStyle(selectedElement, { fontSize: Math.max(8, elStyle.fontSize - 1) })}
                                                                    className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                >−</button>
                                                                <span className="text-xs text-[#c9d1d9] w-10 text-center">{elStyle.fontSize}px</span>
                                                                <button
                                                                    onClick={() => handleUpdateElementStyle(selectedElement, { fontSize: Math.min(32, elStyle.fontSize + 1) })}
                                                                    className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                >+</button>
                                                            </div>
                                                        </div>
                                                        {/* Color */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-[#8b949e]">Color</span>
                                                            <input
                                                                type="color"
                                                                value={elStyle.color}
                                                                onChange={(e) => handleUpdateElementStyle(selectedElement, { color: e.target.value })}
                                                                className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                                                            />
                                                        </div>
                                                        {/* Bold + Italic */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleUpdateElementStyle(selectedElement, { bold: !elStyle.bold })}
                                                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${elStyle.bold ? 'bg-[#388bfd] text-white' : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'}`}
                                                            >B</button>
                                                            <button
                                                                onClick={() => handleUpdateElementStyle(selectedElement, { italic: !elStyle.italic })}
                                                                className={`px-3 py-1 rounded text-xs italic transition-colors ${elStyle.italic ? 'bg-[#388bfd] text-white' : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'}`}
                                                            >I</button>
                                                        </div>
                                                        {/* Per-element spacing */}
                                                        <div className="border-t border-[#30363d] mt-3 pt-3">
                                                            <p className="text-xs text-[#8b949e] mb-2">Spacing</p>
                                                            {([
                                                                { label: 'Top', key: 'marginTop' as const },
                                                                { label: 'Bottom', key: 'marginBottom' as const },
                                                                { label: 'Left', key: 'marginLeft' as const },
                                                                { label: 'Right', key: 'marginRight' as const },
                                                            ]).map(({ label, key }) => (
                                                                <div key={key} className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs text-[#8b949e]">{label}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleUpdateElementStyle(selectedElement, { [key]: Math.max(0, (elStyle[key] || 0) - 4) })}
                                                                            className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                        >−</button>
                                                                        <span className="w-10 text-center text-xs text-[#c9d1d9]">{elStyle[key] || 0}px</span>
                                                                        <button
                                                                            onClick={() => handleUpdateElementStyle(selectedElement, { [key]: Math.min(120, (elStyle[key] || 0) + 4) })}
                                                                            className="w-6 h-6 bg-[#21262d] rounded text-[#8b949e] hover:bg-[#30363d] flex items-center justify-center text-sm"
                                                                        >+</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        )}
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

                                    {/* Spacing */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-[#8b949e] uppercase tracking-wide">Spacing</p>
                                        <SpacingInput label="Element gap" value={footer.elementGap ?? 24} onChange={(v) => updateFooter({ elementGap: v })} max={64} />
                                    </div>
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
                                <div className="flex items-center gap-2 mb-3">
                                    <p className="text-xs text-[#8b949e] uppercase tracking-wide">Live Preview</p>
                                    <GripVertical size={12} className="text-[#6e7681]" />
                                    <span className="text-[10px] text-[#6e7681]">Drag to reorder, click to style</span>
                                </div>
                                <Preview
                                    header={header}
                                    footer={footer}
                                    selectedElement={selectedElement}
                                    onSelectElement={setSelectedElement}
                                    onHeaderDragEnd={handleHeaderDragEnd}
                                    onFooterDragEnd={handleFooterDragEnd}
                                />

                                {/* Per-element style editor */}
                                {canStyleElement && (
                                    <ElementStyleEditor
                                        label={getElementLabel(selectedElement!)}
                                        style={getElementStyle(selectedElement!)}
                                        onChange={(style) => handleUpdateElementStyle(selectedElement!, style)}
                                        onClose={() => setSelectedElement(null)}
                                    />
                                )}
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

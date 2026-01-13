'use client';

import { useState } from 'react';
import { X, Image, Building2, FileText, Calendar, Hash } from 'lucide-react';
import { useHeaderFooterStore } from '@/store/headerFooterStore';

interface HeaderFooterModalProps {
    onClose: () => void;
}

type Tab = 'header' | 'footer';

export default function HeaderFooterModal({ onClose }: HeaderFooterModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('header');
    const { header, footer, updateHeader, updateFooter } = useHeaderFooterStore();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-lg bg-[#161b22] rounded-lg shadow-2xl border border-[#30363d]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
                    <h2 className="text-lg font-semibold text-[#c9d1d9]">Edit Header & Footer</h2>
                    <button onClick={onClose} className="p-1 hover:bg-[#21262d] rounded transition-colors">
                        <X size={18} className="text-[#8b949e]" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#21262d]">
                    <button
                        onClick={() => setActiveTab('header')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'header'
                                ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                                : 'text-[#8b949e] hover:text-[#c9d1d9]'
                            }`}
                    >
                        Header
                    </button>
                    <button
                        onClick={() => setActiveTab('footer')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'footer'
                                ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                                : 'text-[#8b949e] hover:text-[#c9d1d9]'
                            }`}
                    >
                        Footer
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'header' && (
                        <div className="space-y-4">
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

                            {/* Logo URL */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-[#8b949e] mb-2">
                                    <Image size={14} />
                                    Logo URL
                                </label>
                                <input
                                    type="text"
                                    value={header.logoUrl}
                                    onChange={(e) => updateHeader({ logoUrl: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[#c9d1d9] text-sm focus:outline-none focus:border-[#388bfd]"
                                    placeholder="https://example.com/logo.png"
                                />
                            </div>

                            {/* Show Logo Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={header.showLogo}
                                    onChange={(e) => updateHeader({ showLogo: e.target.checked })}
                                    className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd] focus:ring-[#388bfd]"
                                />
                                <span className="text-sm text-[#c9d1d9]">Show logo in header</span>
                            </label>
                        </div>
                    )}

                    {activeTab === 'footer' && (
                        <div className="space-y-4">
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

                            {/* Options */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={footer.showPageNumbers}
                                        onChange={(e) => updateFooter({ showPageNumbers: e.target.checked })}
                                        className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd] focus:ring-[#388bfd]"
                                    />
                                    <Hash size={14} className="text-[#8b949e]" />
                                    <span className="text-sm text-[#c9d1d9]">Show page numbers</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={footer.showDate}
                                        onChange={(e) => updateFooter({ showDate: e.target.checked })}
                                        className="w-4 h-4 rounded bg-[#21262d] border-[#30363d] text-[#388bfd] focus:ring-[#388bfd]"
                                    />
                                    <Calendar size={14} className="text-[#8b949e]" />
                                    <span className="text-sm text-[#c9d1d9]">Show date</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#30363d]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm text-white font-medium transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

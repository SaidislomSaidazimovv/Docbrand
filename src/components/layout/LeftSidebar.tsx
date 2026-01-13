'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, X, Check, Link2, Upload, AlertCircle, FileText, Map, Trash2 } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';
import { useHistoryStore } from '@/store/historyStore';

interface LeftSidebarProps {
    onImportClick?: () => void;
}

export default function LeftSidebar({ onImportClick }: LeftSidebarProps) {
    const [expandedSections, setExpandedSections] = useState<string[]>(['Uncategorized']);
    const [activeTab, setActiveTab] = useState<'map' | 'rfp'>('rfp');

    const { requirements, activeLinkingReqId, setLinkingMode, clearRequirements } = useRequirementsStore();
    const { sources, clearSources } = useSourcesStore();
    const { addToHistory } = useHistoryStore();

    // Clear All handler
    const handleClearAll = () => {
        if (requirements.length === 0 && sources.length === 0) {
            return;
        }
        if (confirm('Clear all imported data? This will be saved to history.')) {
            const linkedCount = requirements.filter(r => r.status === 'linked').length;
            addToHistory({
                sources: [...sources],
                requirements: [...requirements],
                linkedCount,
                totalCount: requirements.length,
            });
            clearRequirements();
            clearSources();
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections((prev) =>
            prev.includes(section)
                ? prev.filter((s) => s !== section)
                : [...prev, section]
        );
    };

    // Group requirements by section
    const grouped = requirements.reduce((acc, req) => {
        const section = req.sectionPath[0] || 'Uncategorized';
        if (!acc[section]) acc[section] = [];
        acc[section].push(req);
        return acc;
    }, {} as Record<string, typeof requirements>);

    // Count stats
    const linkedCount = requirements.filter((r) => r.status === 'linked').length;
    const unlinkedCount = requirements.filter((r) => r.status === 'unlinked').length;
    const totalCount = requirements.length;
    const coveragePercent = totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

    // Get status icon
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'linked':
                return <Check size={12} className="text-[#3fb950]" />;
            case 'partial':
                return <AlertCircle size={12} className="text-[#d29922]" />;
            case 'ignored':
                return <X size={12} className="text-[#8b949e]" />;
            default: // unlinked
                return <div className="w-3 h-3 rounded-full border-2 border-[#d29922]" />;
        }
    };

    const handleLinkClick = (reqId: string) => {
        if (activeLinkingReqId === reqId) {
            setLinkingMode(null);
        } else {
            setLinkingMode(reqId);
        }
    };

    // Empty state check
    const isEmpty = requirements.length === 0;

    return (
        <aside className="w-[280px] flex-shrink-0 bg-[#161b22] border-r border-[#30363d] flex flex-col h-full">
            {/* Header with Coverage */}
            <div className="px-4 py-3 border-b border-[#21262d]">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-sm ${isEmpty ? 'bg-[#8b949e]' : unlinkedCount > 0 ? 'bg-[#f85149]' : 'bg-[#3fb950]'}`} />
                        <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">
                            RFP Coverage
                        </span>
                    </div>
                    {!isEmpty && (
                        <span className={`text-sm font-bold ${coveragePercent === 100 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                            {coveragePercent}%
                        </span>
                    )}
                </div>

                {/* Progress bar */}
                {!isEmpty && (
                    <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#f85149] via-[#d29922] to-[#3fb950] transition-all duration-300"
                            style={{ width: `${coveragePercent}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Tabs */}
            {!isEmpty && (
                <div className="flex border-b border-[#21262d]">
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${activeTab === 'map'
                            ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                            : 'text-[#8b949e] hover:text-[#c9d1d9]'
                            }`}
                    >
                        <Map size={12} />
                        Map
                    </button>
                    <button
                        onClick={() => setActiveTab('rfp')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${activeTab === 'rfp'
                            ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                            : 'text-[#8b949e] hover:text-[#c9d1d9]'
                            }`}
                    >
                        <FileText size={12} />
                        RFP
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {isEmpty ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                        <div className="w-16 h-16 bg-[#21262d] rounded-full flex items-center justify-center mb-4">
                            <FileText size={24} className="text-[#8b949e]" />
                        </div>
                        <h3 className="text-sm font-medium text-[#c9d1d9] mb-2">
                            No RFP Imported
                        </h3>
                        <p className="text-xs text-[#8b949e] mb-4">
                            Import an RFP document to extract requirements and track coverage.
                        </p>
                        <button
                            onClick={onImportClick}
                            className="flex items-center gap-2 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm text-white font-medium transition-colors"
                        >
                            <Upload size={14} />
                            Import RFP
                        </button>
                    </div>
                ) : activeTab === 'map' ? (
                    /* Map View - Document Structure */
                    <div className="p-4">
                        <p className="text-xs text-[#8b949e] mb-4">
                            Document structure showing linked requirements
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2 bg-[#21262d] rounded">
                                <div className="w-1 h-8 bg-[#3fb950] rounded" />
                                <div>
                                    <p className="text-sm text-[#c9d1d9]">Executive Summary</p>
                                    <p className="text-xs text-[#8b949e]">{linkedCount} linked</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-[#21262d] rounded">
                                <div className="w-1 h-8 bg-[#d29922] rounded" />
                                <div>
                                    <p className="text-sm text-[#c9d1d9]">Technical Approach</p>
                                    <p className="text-xs text-[#8b949e]">0 linked</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-[#21262d] rounded">
                                <div className="w-1 h-8 bg-[#f85149] rounded" />
                                <div>
                                    <p className="text-sm text-[#c9d1d9]">Management Plan</p>
                                    <p className="text-xs text-[#8b949e]">{unlinkedCount} unlinked</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* RFP Requirements List */
                    Object.entries(grouped).map(([section, sectionReqs]) => {
                        const isExpanded = expandedSections.includes(section);
                        const sectionUnlinked = sectionReqs.filter(r => r.status === 'unlinked').length;

                        return (
                            <div key={section}>
                                {/* Section Header */}
                                <button
                                    onClick={() => toggleSection(section)}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#21262d] transition-colors"
                                >
                                    {isExpanded ? (
                                        <ChevronDown size={12} className="text-[#8b949e]" />
                                    ) : (
                                        <ChevronRight size={12} className="text-[#8b949e]" />
                                    )}
                                    <FileText size={12} className="text-[#8b949e]" />
                                    <span className="text-sm text-[#c9d1d9] flex-1 text-left truncate">{section}</span>
                                    {sectionUnlinked > 0 ? (
                                        <span className="text-xs px-1.5 py-0.5 bg-[#f8514922] text-[#f85149] rounded">
                                            {sectionUnlinked}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-[#3fb950]">✓</span>
                                    )}
                                </button>

                                {/* Requirements */}
                                {isExpanded && (
                                    <div className="pl-4">
                                        {sectionReqs.map((req) => {
                                            const isLinking = activeLinkingReqId === req.id;

                                            return (
                                                <div
                                                    key={req.id}
                                                    className={`flex items-start gap-2 px-4 py-2 cursor-pointer transition-colors group ${isLinking
                                                        ? 'bg-[#388bfd22] border-l-2 border-[#388bfd]'
                                                        : 'hover:bg-[#21262d]'
                                                        }`}
                                                >
                                                    {/* Status indicator */}
                                                    <div className="mt-0.5 flex-shrink-0">
                                                        {getStatusIcon(req.status)}
                                                    </div>

                                                    {/* Requirement info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-mono ${req.status === 'linked' ? 'text-[#3fb950]' : 'text-[#f85149]'
                                                                }`}>
                                                                {req.id}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-[#8b949e] truncate mt-0.5">
                                                            {req.text}
                                                        </p>
                                                    </div>

                                                    {/* Link button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLinkClick(req.id);
                                                        }}
                                                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${isLinking
                                                            ? 'opacity-100 bg-[#388bfd] text-white'
                                                            : 'hover:bg-[#30363d] text-[#8b949e]'
                                                            }`}
                                                        title={isLinking ? 'Cancel linking' : 'Link to block'}
                                                    >
                                                        <Link2 size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            {!isEmpty && (
                <div className="p-3 border-t border-[#21262d]">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={onImportClick}
                            className="flex items-center justify-center gap-2 py-2 bg-[#21262d] hover:bg-[#30363d] rounded text-sm text-[#c9d1d9] transition-colors"
                        >
                            <Upload size={14} />
                            Import
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="flex items-center justify-center gap-2 py-2 bg-[#21262d] hover:bg-[#f8514933] rounded text-sm text-[#f85149] transition-colors"
                        >
                            <Trash2 size={14} />
                            Clear All
                        </button>
                    </div>

                    {unlinkedCount > 0 && (
                        <div className="mt-3 flex items-center gap-2 px-2 py-1.5 bg-[#f8514922] rounded">
                            <span className="text-sm font-medium text-[#f85149]">
                                {unlinkedCount} Issue{unlinkedCount > 1 ? 's' : ''}
                            </span>
                            <X size={12} className="text-[#f85149]" />
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}

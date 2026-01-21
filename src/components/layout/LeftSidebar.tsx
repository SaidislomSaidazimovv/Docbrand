'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Upload, FileText, Map, Trash2, Folder, ExternalLink, Unlink } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';
import { useHistoryStore } from '@/store/historyStore';
import { EditorController } from '@/lib/editor';
import { unmarkBlockAsLinked } from '@/lib/editor/plugins/LinkedBlockDecorator';
import type { Requirement } from '@/types';

interface LeftSidebarProps {
    onImportClick?: () => void;
}

// Section type for grouped requirements
interface Section {
    id: string;
    name: string;
    requirements: Requirement[];
}

export default function LeftSidebar({ onImportClick }: LeftSidebarProps) {
    const [expandedSections, setExpandedSections] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'map' | 'rfp'>('rfp');

    const { requirements, activeLinkingReqId, setLinkingMode, clearRequirements, unlinkFromBlock } = useRequirementsStore();
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

    // Group requirements by section with progress calculation
    const sections: Section[] = useMemo(() => {
        const sectionRecord: Record<string, Section> = {};

        for (const req of requirements) {
            const sectionId = req.sectionPath[0] || 'Uncategorized';

            if (!sectionRecord[sectionId]) {
                sectionRecord[sectionId] = {
                    id: sectionId,
                    name: sectionId,
                    requirements: []
                };
            }

            sectionRecord[sectionId].requirements.push(req);
        }

        return Object.values(sectionRecord).sort((a, b) =>
            a.id.localeCompare(b.id, undefined, { numeric: true })
        );
    }, [requirements]);

    // Count stats
    const linkedCount = requirements.filter((r) => r.status === 'linked').length;
    const unlinkedCount = requirements.filter((r) => r.status === 'unlinked').length;
    const totalCount = requirements.length;
    const coveragePercent = totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

    // Get status dot color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'linked':
                return 'bg-[#3fb950]'; // Green
            case 'partial':
                return 'bg-[#d29922]'; // Orange
            case 'ignored':
                return 'bg-[#8b949e]'; // Gray
            default: // unlinked
                return 'bg-[#f85149]'; // Red
        }
    };

    // Calculate section progress
    const getSectionProgress = (sectionReqs: typeof requirements) => {
        if (sectionReqs.length === 0) return 0;
        const linked = sectionReqs.filter(r => r.status === 'linked').length;
        return Math.round((linked / sectionReqs.length) * 100);
    };

    // Get progress bar color classes
    const getProgressColors = (percent: number) => {
        if (percent === 100) return 'from-[#3fb950] to-[#3fb950]';
        if (percent >= 60) return 'from-[#3fb950] to-[#d29922]';
        if (percent >= 30) return 'from-[#d29922] to-[#f85149]';
        return 'from-[#f85149] to-[#f85149]';
    };

    const handleLinkClick = (reqId: string, e?: React.MouseEvent) => {
        // If holding Shift, navigate to linked block instead of linking
        if (e?.shiftKey) {
            const linkedBlocks = EditorController.getBlocksForRequirement(reqId);
            if (linkedBlocks.length > 0) {
                EditorController.scrollToBlock(linkedBlocks[0]);
                return;
            }
        }

        // Toggle linking mode
        if (activeLinkingReqId === reqId) {
            setLinkingMode(null);
        } else {
            setLinkingMode(reqId);
        }
    };

    // Unlink a requirement from its block
    const handleUnlink = (reqId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const req = requirements.find(r => r.id === reqId);
        if (req?.linkedBlockIds && req.linkedBlockIds.length > 0) {
            const blockId = req.linkedBlockIds[0];
            console.log('[Sidebar] Unlinking:', reqId, 'from', blockId);

            // Method 1: Find by data-block-id
            const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
            if (blockElement) {
                (blockElement as HTMLElement).style.borderLeft = '';
                (blockElement as HTMLElement).style.paddingLeft = '';
                (blockElement as HTMLElement).style.marginLeft = '';
                blockElement.classList.remove('block-linked');
                blockElement.removeAttribute('data-linked');
                blockElement.removeAttribute('data-block-id');
                console.log('[Sidebar] Cleared by data-block-id');
            }

            // Method 2: Find ALL elements with block-linked class or data-linked attribute
            const linkedElements = document.querySelectorAll('.ProseMirror .block-linked, .ProseMirror [data-linked="true"], .tiptap .block-linked, .tiptap [data-linked="true"]');
            console.log('[Sidebar] Found linked elements to clear:', linkedElements.length);
            linkedElements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                htmlEl.style.borderLeft = '';
                htmlEl.style.paddingLeft = '';
                htmlEl.style.marginLeft = '';
                htmlEl.classList.remove('block-linked');
                htmlEl.removeAttribute('data-linked');
                htmlEl.removeAttribute('data-block-id');
                console.log('[Sidebar] Cleared .block-linked element:', el.textContent?.substring(0, 30));
            });


            // Remove from decorator's linked blocks Set - THIS IS THE KEY FIX
            unmarkBlockAsLinked(blockId);

            // Unlink from store
            unlinkFromBlock(reqId, blockId);

            // Force editor refresh to clear visual indicators
            EditorController.forceRefresh();
            console.log('[Sidebar] Unlinked successfully');
        }
    };

    // Navigate to first linked block
    const handleNavigateToBlock = (reqId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // First try EditorController (Path E - document-based)
        let linkedBlocks = EditorController.getBlocksForRequirement(reqId);

        // Fallback to Zustand store (legacy linking)
        if (linkedBlocks.length === 0) {
            const req = requirements.find(r => r.id === reqId);
            if (req?.linkedBlockIds && req.linkedBlockIds.length > 0) {
                linkedBlocks = req.linkedBlockIds;
            }
        }

        if (linkedBlocks.length > 0) {
            const blockId = linkedBlocks[0];

            // Try EditorController scroll first
            const success = EditorController.scrollToBlock(blockId);

            // Fallback: Find by DOM data-block-id
            if (!success) {
                const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
                if (blockElement) {
                    blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add highlight animation class
                    blockElement.classList.add('block-highlight');
                    setTimeout(() => {
                        blockElement.classList.remove('block-highlight');
                    }, 2000);
                } else {
                    console.warn(`Block not found: ${blockId}`);
                }
            }
        } else {
            console.warn(`No linked blocks for requirement: ${reqId}`);
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
                    /* RFP Requirements - Grouped by Section */
                    <div className="p-2">
                        <p className="text-[10px] text-[#6e7681] uppercase tracking-wider px-2 mb-2">
                            RFP Requirements
                        </p>

                        {sections.map((section) => {
                            const isExpanded = expandedSections.includes(section.id);
                            const progress = getSectionProgress(section.requirements);

                            return (
                                <div key={section.id} className="mb-2">
                                    {/* Section Header - Like the reference image */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className="w-full bg-[#21262d] rounded-lg p-3 hover:bg-[#30363d] transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Folder size={16} className="text-[#8b949e]" />
                                            <span className="text-sm font-medium text-[#c9d1d9] flex-1 text-left truncate">
                                                {section.name}
                                            </span>
                                            {/* Mini progress bar */}
                                            <div className="w-16 h-1.5 bg-[#161b22] rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full bg-gradient-to-r ${getProgressColors(progress)} transition-all`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-medium ${progress === 100 ? 'text-[#3fb950]' : progress > 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>
                                                {progress}%
                                            </span>
                                            {isExpanded ? (
                                                <ChevronDown size={14} className="text-[#8b949e]" />
                                            ) : (
                                                <ChevronRight size={14} className="text-[#8b949e]" />
                                            )}
                                        </div>
                                    </button>

                                    {/* Requirements in Section */}
                                    {isExpanded && (
                                        <div className="ml-4 mt-1 space-y-1">
                                            {section.requirements.map((req) => (
                                                <div
                                                    key={req.id}
                                                    onClick={() => handleLinkClick(req.id)}
                                                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${activeLinkingReqId === req.id
                                                        ? 'bg-[#388bfd22] border border-[#388bfd]'
                                                        : 'hover:bg-[#21262d]'
                                                        }`}
                                                >
                                                    {/* Status dot */}
                                                    <div className={`w-2 h-2 rounded-full mt-1.5 ${getStatusColor(req.status)}`} />

                                                    {/* Requirement info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-mono text-[#8b949e]">
                                                                {req.id.substring(0, 12)}
                                                            </span>
                                                        </div>
                                                        <p
                                                            className="text-xs text-[#c9d1d9] line-clamp-1"
                                                            title={req.originalText || req.text}
                                                        >
                                                            {req.text.length > 35 ? req.text.substring(0, 35) + '...' : req.text}
                                                        </p>
                                                        {/* Navigate to block button for linked requirements */}
                                                        {req.status === 'linked' && req.linkedBlockIds && req.linkedBlockIds.length > 0 && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <button
                                                                    onClick={(e) => handleNavigateToBlock(req.id, e)}
                                                                    className="flex items-center gap-1 text-[10px] text-[#388bfd] hover:text-[#58a6ff]"
                                                                    title="Go to linked block"
                                                                >
                                                                    <ExternalLink size={10} />
                                                                    Go to block
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleUnlink(req.id, e)}
                                                                    className="flex items-center gap-1 text-[10px] text-[#f85149] hover:text-[#ff6a6a]"
                                                                    title="Remove link"
                                                                >
                                                                    <Unlink size={10} />
                                                                    Unlink
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#21262d]">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onImportClick}
                        className="flex items-center justify-center gap-2 py-2 bg-[#21262d] hover:bg-[#30363d] rounded-lg text-xs text-[#c9d1d9] font-medium transition-colors"
                    >
                        <Upload size={12} />
                        Import
                    </button>
                    <button
                        onClick={handleClearAll}
                        disabled={isEmpty}
                        className="flex items-center justify-center gap-2 py-2 bg-[#21262d] hover:bg-[#f8514922] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs text-[#f85149] font-medium transition-colors"
                    >
                        <Trash2 size={12} />
                        Clear All
                    </button>
                </div>

                {/* Issue count */}
                {!isEmpty && unlinkedCount > 0 && (
                    <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-[#f8514922] rounded text-xs text-[#f85149]">
                        <span className="font-medium">{unlinkedCount} Issues</span>
                        <button className="ml-auto text-[#f85149] hover:text-white">×</button>
                    </div>
                )}
            </div>
        </aside>
    );
}

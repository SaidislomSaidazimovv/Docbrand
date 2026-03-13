'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Upload, FileText, Map, Trash2, Folder, ExternalLink, Unlink } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';
import { useHistoryStore } from '@/store/historyStore';
import { useStyleStore } from '@/store/styleStore';
import { useEditorStore } from '@/store/editorStore';
import { EditorController } from '@/lib/editor';
import { unmarkBlockAsLinked } from '@/lib/editor/plugins/LinkedBlockDecorator';
import ConfirmModal from '@/components/modals/ConfirmModal';
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
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const { requirements, activeLinkingReqId, setLinkingMode, clearRequirements, unlinkFromBlock } = useRequirementsStore();
    const { sources, clearSources } = useSourcesStore();
    const { addToHistory } = useHistoryStore();

    // Clear All handler
    const handleClearAll = () => {
        const editor = useEditorStore.getState().editor;
        const hasEditorContent = editor ? !editor.isEmpty : false;
        if (requirements.length === 0 && sources.length === 0 && !hasEditorContent) {
            return;
        }
        setShowClearConfirm(true);
    };

    const confirmClearAll = () => {
        const linkedCount = requirements.filter(r => r.status === 'linked').length;
        addToHistory({
            sources: [...sources],
            requirements: [...requirements],
            linkedCount,
            totalCount: requirements.length,
        });
        clearRequirements();
        clearSources();
        useStyleStore.getState().resetToDefaults();
        const editor = useEditorStore.getState().editor;
        if (editor) {
            editor.commands.clearContent();
        }
        setShowClearConfirm(false);
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
                return 'bg-[#1a7f37]'; // Green
            case 'partial':
                return 'bg-[#9a6700]'; // Orange
            case 'ignored':
                return 'bg-[#656d76]'; // Gray
            default: // unlinked
                return 'bg-[#cf222e]'; // Red
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
        if (percent === 100) return 'from-[#1a7f37] to-[#1a7f37]';
        if (percent >= 60) return 'from-[#1a7f37] to-[#9a6700]';
        if (percent >= 30) return 'from-[#9a6700] to-[#cf222e]';
        return 'from-[#cf222e] to-[#cf222e]';
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
        <aside className="w-[280px] min-w-[280px] flex-shrink-0 bg-[#f6f8fa] border-r border-[#d0d7de] flex flex-col h-full">
            {/* Header with Coverage */}
            <div className="px-4 py-3 border-b border-[#eaeef2]">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-sm ${isEmpty ? 'bg-[#656d76]' : unlinkedCount > 0 ? 'bg-[#cf222e]' : 'bg-[#1a7f37]'}`} />
                        <span className="text-xs font-semibold text-[#656d76] uppercase tracking-wide">
                            RFP Coverage
                        </span>
                    </div>
                    {!isEmpty && (
                        <span className={`text-sm font-bold ${coveragePercent === 100 ? 'text-[#1a7f37]' : 'text-[#cf222e]'}`}>
                            {coveragePercent}%
                        </span>
                    )}
                </div>

                {/* Progress bar */}
                {!isEmpty && (
                    <div className="h-1.5 bg-[#eaeef2] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#cf222e] via-[#9a6700] to-[#1a7f37] transition-all duration-300"
                            style={{ width: `${coveragePercent}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Tabs */}
            {!isEmpty && (
                <div className="flex border-b border-[#eaeef2]">
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${activeTab === 'map'
                            ? 'text-[#3fb950] border-b-2 border-[#3fb950]'
                            : 'text-[#656d76] hover:text-[#1f2328]'
                            }`}
                    >
                        <Map size={12} />
                        Map
                    </button>
                    <button
                        onClick={() => setActiveTab('rfp')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${activeTab === 'rfp'
                            ? 'text-[#3fb950] border-b-2 border-[#3fb950]'
                            : 'text-[#656d76] hover:text-[#1f2328]'
                            }`}
                    >
                        <FileText size={12} />
                        RFP
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto sidebar-scroll">
                {isEmpty ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                        <div className="w-16 h-16 bg-[#eaeef2] rounded-full flex items-center justify-center mb-4">
                            <FileText size={24} className="text-[#656d76]" />
                        </div>
                        <h3 className="text-sm font-medium text-[#1f2328] mb-2">
                            No RFP Imported
                        </h3>
                        <p className="text-xs text-[#656d76]">
                            Import an RFP document to extract requirements and track coverage.
                        </p>
                    </div>
                ) : activeTab === 'map' ? (
                    /* Map View - Document Structure */
                    <div className="p-4">
                        <p className="text-xs text-[#656d76] mb-4">
                            Document structure showing linked requirements
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2 bg-[#eaeef2] rounded">
                                <div className="w-1 h-8 bg-[#1a7f37] rounded" />
                                <div>
                                    <p className="text-sm text-[#1f2328]">Executive Summary</p>
                                    <p className="text-xs text-[#656d76]">{linkedCount} linked</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-[#eaeef2] rounded">
                                <div className="w-1 h-8 bg-[#9a6700] rounded" />
                                <div>
                                    <p className="text-sm text-[#1f2328]">Technical Approach</p>
                                    <p className="text-xs text-[#656d76]">0 linked</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-[#eaeef2] rounded">
                                <div className="w-1 h-8 bg-[#cf222e] rounded" />
                                <div>
                                    <p className="text-sm text-[#1f2328]">Management Plan</p>
                                    <p className="text-xs text-[#656d76]">{unlinkedCount} unlinked</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* RFP Requirements - Grouped by Section */
                    <div className="p-2">
                        <p className="text-[10px] text-[#9198a1] uppercase tracking-wider px-2 mb-2">
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
                                        className="w-full bg-[#eaeef2] rounded-lg p-3 hover:bg-[#d0d7de] transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Folder size={16} className="text-[#656d76]" />
                                            <span className="text-sm font-medium text-[#1f2328] flex-1 text-left truncate">
                                                {section.name}
                                            </span>
                                            {/* Mini progress bar */}
                                            <div className="w-16 h-1.5 bg-[#f6f8fa] rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full bg-gradient-to-r ${getProgressColors(progress)} transition-all`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-medium ${progress === 100 ? 'text-[#1a7f37]' : progress > 50 ? 'text-[#9a6700]' : 'text-[#cf222e]'}`}>
                                                {progress}%
                                            </span>
                                            {isExpanded ? (
                                                <ChevronDown size={14} className="text-[#656d76]" />
                                            ) : (
                                                <ChevronRight size={14} className="text-[#656d76]" />
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
                                                    draggable={true}
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('application/x-requirement-id', req.id);
                                                        e.dataTransfer.effectAllowed = 'link';
                                                        e.currentTarget.style.opacity = '0.5';
                                                    }}
                                                    onDragEnd={(e) => {
                                                        e.currentTarget.style.opacity = '1';
                                                    }}
                                                    className={`flex items-start gap-3 p-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${activeLinkingReqId === req.id
                                                        ? 'bg-[#3fb95022] border border-[#3fb950]'
                                                        : 'hover:bg-[#eaeef2]'
                                                        }`}
                                                >
                                                    {/* Status dot */}
                                                    <div className={`w-2 h-2 rounded-full mt-1.5 ${getStatusColor(req.status)}`} />

                                                    {/* Requirement info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-mono text-[#656d76]">
                                                                {req.id.substring(0, 12)}
                                                            </span>
                                                        </div>
                                                        <p
                                                            className="text-xs text-[#1f2328] line-clamp-1"
                                                            title={req.originalText || req.text}
                                                        >
                                                            {req.text.length > 35 ? req.text.substring(0, 35) + '...' : req.text}
                                                        </p>
                                                        {/* Navigate to block button for linked requirements */}
                                                        {req.status === 'linked' && req.linkedBlockIds && req.linkedBlockIds.length > 0 && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <button
                                                                    onClick={(e) => handleNavigateToBlock(req.id, e)}
                                                                    className="flex items-center gap-1 text-[10px] text-[#3fb950] hover:text-[#4cc764]"
                                                                    title="Go to linked block"
                                                                >
                                                                    <ExternalLink size={10} />
                                                                    Go to block
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleUnlink(req.id, e)}
                                                                    className="flex items-center gap-1 text-[10px] text-[#cf222e] hover:text-[#ff6a6a]"
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
            <div className="p-3 border-t border-[#eaeef2]">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onImportClick}
                        className="flex items-center justify-center gap-2 py-2 bg-[#eaeef2] hover:bg-[#d0d7de] rounded-lg text-xs text-[#1f2328] font-medium transition-colors"
                    >
                        <Upload size={12} />
                        Import
                    </button>
                    <button
                        onClick={handleClearAll}
                        disabled={isEmpty}
                        className="flex items-center justify-center gap-2 py-2 bg-[#eaeef2] hover:bg-[#cf222e22] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs text-[#cf222e] font-medium transition-colors"
                    >
                        <Trash2 size={12} />
                        Clear All
                    </button>
                </div>

                {/* Issue count */}
                {!isEmpty && unlinkedCount > 0 && (
                    <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-[#cf222e22] rounded text-xs text-[#cf222e]">
                        <span className="font-medium">{unlinkedCount} Issues</span>
                        <button className="ml-auto text-[#cf222e] hover:text-white">×</button>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={showClearConfirm}
                title="Clear All"
                message="Clear all imported data? This will be saved to history."
                confirmLabel="OK"
                cancelLabel="Cancel"
                onConfirm={confirmClearAll}
                onCancel={() => setShowClearConfirm(false)}
            />
        </aside>
    );
}

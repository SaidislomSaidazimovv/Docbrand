'use client';

import { useState } from 'react';
import { X, Check, Link2 } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import { EditorController } from '@/lib/editor';

interface RequirementLinkPopupProps {
    blockId: string;
    onClose: () => void;
    position: { x: number; y: number };
}

export default function RequirementLinkPopup({ blockId, onClose }: RequirementLinkPopupProps) {
    const { requirements, linkToBlock, unlinkFromBlock } = useRequirementsStore();
    const [searchTerm, setSearchTerm] = useState('');

    // Get unlinked requirements
    const unlinkedReqs = requirements.filter(r => r.status === 'unlinked');

    // Get already linked requirements for this block
    const linkedReqs = requirements.filter(r => r.linkedBlockIds.includes(blockId));

    // Filter by search
    const filteredUnlinked = unlinkedReqs.filter(r =>
        r.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleLink = (reqId: string) => {
        // Update Zustand store (UI state)
        linkToBlock(reqId, blockId);

        // Also update document via EditorController (Path E canonical storage)
        EditorController.linkRequirementToBlock(blockId, reqId);
    };

    const handleUnlink = (reqId: string) => {
        // Update Zustand store (UI state)
        unlinkFromBlock(reqId, blockId);

        // Also update document via EditorController (Path E canonical storage)
        EditorController.unlinkRequirementFromBlock(blockId, reqId);
    };

    return (
        <div
            className="fixed z-50 w-96 bg-[#f6f8fa] border border-[#d0d7de] rounded-lg shadow-2xl overflow-hidden"
            style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                maxHeight: '80vh'
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#d0d7de] bg-[#eaeef2]">
                <span className="text-sm font-semibold text-[#1f2328]">Link Requirement</span>
                <button onClick={onClose} className="p-1 hover:bg-[#d0d7de] rounded transition-colors">
                    <X size={16} className="text-[#656d76]" />
                </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-[#d0d7de]">
                <input
                    type="text"
                    placeholder="Search requirements..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-[#ffffff] border border-[#d0d7de] rounded text-sm text-[#1f2328] focus:outline-none focus:border-[#0969da]"
                    autoFocus
                />
            </div>

            {/* Scrollable content */}
            <div className="max-h-[400px] overflow-y-auto">
                {/* Linked Requirements */}
                {linkedReqs.length > 0 && (
                    <div className="px-4 py-3 border-b border-[#d0d7de]">
                        <p className="text-xs font-medium text-[#1a7f37] mb-2 uppercase tracking-wide">
                            Linked ({linkedReqs.length})
                        </p>
                        <div className="space-y-2">
                            {linkedReqs.map(req => (
                                <div
                                    key={req.id}
                                    className="flex items-center gap-3 p-3 bg-[#1a7f3715] border border-[#1a7f3733] rounded-lg group"
                                >
                                    <Check size={14} className="text-[#1a7f37] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono text-[#1a7f37]">{req.id}</p>
                                        <p className="text-xs text-[#656d76] truncate">{req.text}</p>
                                    </div>
                                    <button
                                        onClick={() => handleUnlink(req.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#cf222e33] rounded transition-all"
                                        title="Unlink requirement"
                                    >
                                        <X size={14} className="text-[#cf222e]" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Unlinked Requirements */}
                <div className="px-4 py-3">
                    <p className="text-xs font-medium text-[#cf222e] mb-2 uppercase tracking-wide">
                        Unlinked ({filteredUnlinked.length})
                    </p>
                    {filteredUnlinked.length === 0 ? (
                        <p className="text-sm text-[#656d76] py-4 text-center">
                            No unlinked requirements
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {filteredUnlinked.map(req => (
                                <button
                                    key={req.id}
                                    onClick={() => handleLink(req.id)}
                                    className="w-full flex items-center gap-3 p-3 bg-[#eaeef2] hover:bg-[#d0d7de] border border-[#d0d7de] rounded-lg text-left transition-colors"
                                >
                                    <Link2 size={14} className="text-[#656d76] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono text-[#cf222e]">{req.id}</p>
                                        <p className="text-xs text-[#656d76] truncate">{req.text}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState } from 'react';
import { X, Check, Link2 } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';

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
        linkToBlock(reqId, blockId);
    };

    const handleUnlink = (reqId: string) => {
        unlinkFromBlock(reqId, blockId);
    };

    return (
        <div
            className="fixed z-50 w-96 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden"
            style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                maxHeight: '80vh'
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#21262d]">
                <span className="text-sm font-semibold text-[#c9d1d9]">Link Requirement</span>
                <button onClick={onClose} className="p-1 hover:bg-[#30363d] rounded transition-colors">
                    <X size={16} className="text-[#8b949e]" />
                </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-[#30363d]">
                <input
                    type="text"
                    placeholder="Search requirements..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"
                    autoFocus
                />
            </div>

            {/* Scrollable content */}
            <div className="max-h-[400px] overflow-y-auto">
                {/* Linked Requirements */}
                {linkedReqs.length > 0 && (
                    <div className="px-4 py-3 border-b border-[#30363d]">
                        <p className="text-xs font-medium text-[#3fb950] mb-2 uppercase tracking-wide">
                            Linked ({linkedReqs.length})
                        </p>
                        <div className="space-y-2">
                            {linkedReqs.map(req => (
                                <div
                                    key={req.id}
                                    className="flex items-center gap-3 p-3 bg-[#3fb95015] border border-[#3fb95033] rounded-lg group"
                                >
                                    <Check size={14} className="text-[#3fb950] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono text-[#3fb950]">{req.id}</p>
                                        <p className="text-xs text-[#8b949e] truncate">{req.text}</p>
                                    </div>
                                    <button
                                        onClick={() => handleUnlink(req.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#f8514933] rounded transition-all"
                                        title="Unlink requirement"
                                    >
                                        <X size={14} className="text-[#f85149]" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Unlinked Requirements */}
                <div className="px-4 py-3">
                    <p className="text-xs font-medium text-[#f85149] mb-2 uppercase tracking-wide">
                        Unlinked ({filteredUnlinked.length})
                    </p>
                    {filteredUnlinked.length === 0 ? (
                        <p className="text-sm text-[#8b949e] py-4 text-center">
                            No unlinked requirements
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {filteredUnlinked.map(req => (
                                <button
                                    key={req.id}
                                    onClick={() => handleLink(req.id)}
                                    className="w-full flex items-center gap-3 p-3 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-lg text-left transition-colors"
                                >
                                    <Link2 size={14} className="text-[#8b949e] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono text-[#f85149]">{req.id}</p>
                                        <p className="text-xs text-[#8b949e] truncate">{req.text}</p>
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

'use client';

import { useState } from 'react';
import { X, History, Trash2, RotateCcw, Clock, FileText, Link2 } from 'lucide-react';
import { useHistoryStore } from '@/store/historyStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';

interface SettingsModalProps {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'history' | 'general'>('history');

    const { history, clearHistory, removeHistoryEntry } = useHistoryStore();
    const { importRequirements } = useRequirementsStore();
    const { sources, clearSources } = useSourcesStore();

    // Restore from history
    const handleRestore = (entryId: string) => {
        const entry = history.find(h => h.id === entryId);
        if (!entry) return;

        if (confirm('Restore this session? Current data will be replaced.')) {
            // Restore requirements
            importRequirements(entry.requirements);
            // Note: Sources would need a bulk restore if desired
            alert(`Restored ${entry.totalCount} requirements (${entry.linkedCount} linked)`);
        }
    };

    // Format date
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-[#161b22] rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl border border-[#30363d]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
                    <h2 className="text-lg font-semibold text-[#c9d1d9]">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[#21262d] rounded transition-colors"
                    >
                        <X size={20} className="text-[#8b949e]" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#30363d]">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'history'
                                ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                                : 'text-[#8b949e] hover:text-[#c9d1d9]'
                            }`}
                    >
                        <History size={14} />
                        History
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'general'
                                ? 'text-[#388bfd] border-b-2 border-[#388bfd]'
                                : 'text-[#8b949e] hover:text-[#c9d1d9]'
                            }`}
                    >
                        General
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'history' ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-[#8b949e]">
                                    Cleared sessions are saved here for recovery
                                </p>
                                {history.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Delete all history?')) {
                                                clearHistory();
                                            }
                                        }}
                                        className="text-xs text-[#f85149] hover:underline"
                                    >
                                        Clear All History
                                    </button>
                                )}
                            </div>

                            {history.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-[#21262d] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <History size={24} className="text-[#8b949e]" />
                                    </div>
                                    <p className="text-sm text-[#8b949e]">No history yet</p>
                                    <p className="text-xs text-[#6e7681] mt-1">
                                        Cleared sessions will appear here
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="bg-[#21262d] rounded-lg p-4 border border-[#30363d]"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Clock size={12} className="text-[#8b949e]" />
                                                        <span className="text-xs text-[#8b949e]">
                                                            {formatDate(entry.clearedAt)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-4 mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <FileText size={14} className="text-[#388bfd]" />
                                                            <span className="text-sm text-[#c9d1d9]">
                                                                {entry.totalCount} requirements
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Link2 size={14} className="text-[#3fb950]" />
                                                            <span className="text-sm text-[#c9d1d9]">
                                                                {entry.linkedCount} linked
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-[#6e7681]">
                                                        {entry.sources.length} source file{entry.sources.length !== 1 ? 's' : ''}
                                                        {entry.sources.length > 0 && (
                                                            <span className="ml-1">
                                                                ({entry.sources.map(s => s.filename).join(', ')})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleRestore(entry.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] rounded text-xs text-white transition-colors"
                                                    >
                                                        <RotateCcw size={12} />
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => removeHistoryEntry(entry.id)}
                                                        className="p-1.5 hover:bg-[#f8514933] rounded transition-colors"
                                                    >
                                                        <Trash2 size={14} className="text-[#f85149]" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium text-[#c9d1d9] mb-2">About</h3>
                                <p className="text-xs text-[#8b949e]">
                                    DocBrand RFP Response Editor v1.0
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-[#c9d1d9] mb-2">Storage</h3>
                                <p className="text-xs text-[#8b949e]">
                                    Your data is stored locally in browser localStorage.
                                </p>
                                <p className="text-xs text-[#6e7681] mt-1">
                                    {sources.length} source files tracked
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-[#c9d1d9] mb-2">Danger Zone</h3>
                                <button
                                    onClick={() => {
                                        if (confirm('Clear ALL local storage? This cannot be undone.')) {
                                            localStorage.clear();
                                            window.location.reload();
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-[#f8514933] hover:bg-[#f8514955] border border-[#f85149] rounded text-xs text-[#f85149] transition-colors"
                                >
                                    Reset All Data
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end px-6 py-4 border-t border-[#30363d]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] rounded text-sm text-[#c9d1d9] transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

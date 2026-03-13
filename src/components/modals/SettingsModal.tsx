'use client';

import { useState } from 'react';
import { X, History, Trash2, RotateCcw, Clock, FileText, Link2 } from 'lucide-react';
import { useHistoryStore } from '@/store/historyStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
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
        <div className={`fixed inset-0 bg-black/60 flex items-center justify-center z-50 modal-overlay ${isOpen ? 'modal-open' : ''}`} onClick={onClose}>
            <div
                className="bg-[#f6f8fa] rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl border border-[#d0d7de] modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#d0d7de]">
                    <h2 className="text-lg font-semibold text-[#1f2328]">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[#eaeef2] rounded transition-colors"
                    >
                        <X size={20} className="text-[#656d76]" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#d0d7de]">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'history'
                                ? 'text-[#3fb950] border-b-2 border-[#3fb950]'
                                : 'text-[#656d76] hover:text-[#1f2328]'
                            }`}
                    >
                        <History size={14} />
                        History
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'general'
                                ? 'text-[#3fb950] border-b-2 border-[#3fb950]'
                                : 'text-[#656d76] hover:text-[#1f2328]'
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
                                <p className="text-sm text-[#656d76]">
                                    Cleared sessions are saved here for recovery
                                </p>
                                {history.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Delete all history?')) {
                                                clearHistory();
                                            }
                                        }}
                                        className="text-xs text-[#cf222e] hover:underline"
                                    >
                                        Clear All History
                                    </button>
                                )}
                            </div>

                            {history.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-[#eaeef2] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <History size={24} className="text-[#656d76]" />
                                    </div>
                                    <p className="text-sm text-[#656d76]">No history yet</p>
                                    <p className="text-xs text-[#9198a1] mt-1">
                                        Cleared sessions will appear here
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="bg-[#eaeef2] rounded-lg p-4 border border-[#d0d7de]"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Clock size={12} className="text-[#656d76]" />
                                                        <span className="text-xs text-[#656d76]">
                                                            {formatDate(entry.clearedAt)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-4 mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <FileText size={14} className="text-[#3fb950]" />
                                                            <span className="text-sm text-[#1f2328]">
                                                                {entry.totalCount} requirements
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Link2 size={14} className="text-[#1a7f37]" />
                                                            <span className="text-sm text-[#1f2328]">
                                                                {entry.linkedCount} linked
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-[#9198a1]">
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
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#1a7f37] hover:bg-[#1a8f3e] rounded text-xs text-white transition-colors"
                                                    >
                                                        <RotateCcw size={12} />
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => removeHistoryEntry(entry.id)}
                                                        className="p-1.5 hover:bg-[#cf222e33] rounded transition-colors"
                                                    >
                                                        <Trash2 size={14} className="text-[#cf222e]" />
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
                                <h3 className="text-sm font-medium text-[#1f2328] mb-2">About</h3>
                                <p className="text-xs text-[#656d76]">
                                    DocBrand RFP Response Editor v1.0
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-[#1f2328] mb-2">Storage</h3>
                                <p className="text-xs text-[#656d76]">
                                    Your data is stored locally in browser localStorage.
                                </p>
                                <p className="text-xs text-[#9198a1] mt-1">
                                    {sources.length} source files tracked
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-[#1f2328] mb-2">Danger Zone</h3>
                                <button
                                    onClick={() => {
                                        if (confirm('Clear ALL local storage? This cannot be undone.')) {
                                            localStorage.clear();
                                            window.location.reload();
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-[#cf222e33] hover:bg-[#cf222e55] border border-[#cf222e] rounded text-xs text-[#cf222e] transition-colors"
                                >
                                    Reset All Data
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end px-6 py-4 border-t border-[#d0d7de]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#eaeef2] hover:bg-[#d0d7de] rounded text-sm text-[#1f2328] transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

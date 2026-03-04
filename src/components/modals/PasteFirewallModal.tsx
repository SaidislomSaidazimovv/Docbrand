'use client';

import { useUIStore } from '@/store/uiStore';
import { useEditorStore } from '@/store/editorStore';
import { X, Shield } from 'lucide-react';

export default function PasteFirewallModal() {
    const pasteModal = useUIStore((s) => s.pasteModal);
    const hidePasteModal = useUIStore((s) => s.hidePasteModal);
    const editor = useEditorStore((s) => s.editor);

    if (!pasteModal) return null;

    const handleApply = () => {
        if (editor && pasteModal.pendingContent) {
            editor.commands.insertContent(pasteModal.pendingContent, {
                parseOptions: { preserveWhitespace: false },
            });
        }
        hidePasteModal();
    };

    const handleCancel = () => {
        hidePasteModal();
    };

    return (
        <>
            <style>{`
                @keyframes pasteModalIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .paste-modal-animate {
                    animation: pasteModalIn 0.2s ease-out forwards;
                }
            `}</style>
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                onClick={handleCancel}
            >
                <div
                    className="paste-modal-animate bg-white rounded-2xl shadow-2xl w-full max-w-lg relative flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex flex-col items-center pt-6 pb-3 px-6">
                        <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4">
                            <Shield size={32} className="text-orange-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                            Paste Firewall
                        </h2>
                        <p className="text-sm text-gray-500 text-center">
                            Content will be sanitized to match brand styles
                        </p>
                        <button
                            onClick={handleCancel}
                            className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={18} className="text-gray-400" />
                        </button>
                    </div>

                <div className="px-6 pb-4 space-y-3 overflow-y-auto max-h-[60vh]">
                    {/* Original (Pasted) */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Original (Pasted)
                        </p>
                        <div className="rounded-xl bg-gray-50 p-4 border-l-4 border-red-400 max-h-28 overflow-y-auto">
                            <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: pasteModal.beforeHtml }}
                            />
                        </div>
                    </div>

                    {/* After Sanitization */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            After Sanitization
                        </p>
                        <div className="rounded-xl bg-gray-50 p-4 border-l-4 border-green-400 max-h-28 overflow-y-auto">
                            <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: pasteModal.afterHtml }}
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    {pasteModal.changes.length > 0 && (
                        <hr className="border-gray-200" />
                    )}

                    {/* Changes List */}
                    <div className="space-y-2">
                        {pasteModal.changes.map((change, i) => {
                            const parts = change.text.split('→');
                            return (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-base">{change.icon}</span>
                                    <div className="text-xs">
                                        <span className="font-medium text-gray-700">
                                            {parts[0].split(':')[0]}:
                                        </span>
                                        {parts[0].includes(':') && (
                                            <span className="line-through text-red-400 ml-1">
                                                {parts[0].split(':')[1]?.trim()}
                                            </span>
                                        )}
                                        {parts[1] && (
                                            <>
                                                <span className="text-gray-400 mx-1">→</span>
                                                <span className="text-green-600">
                                                    {parts[1].trim()}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Buttons — always visible, outside scroll area */}
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
                    >
                        Apply Clean Paste
                    </button>
                </div>
            </div>
        </div>
        </>
    );
}

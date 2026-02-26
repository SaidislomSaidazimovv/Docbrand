'use client';

import { X, Ruler } from 'lucide-react';
import { useStyleStore } from '@/store/styleStore';

interface DocumentSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MARGIN_PRESETS = [
    { label: '1 inch', value: 96 },
    { label: '1.25 inch', value: 120 },
    { label: '1.5 inch', value: 144 },
] as const;

export default function DocumentSettingsModal({ isOpen, onClose }: DocumentSettingsModalProps) {
    const {
        marginTop,
        showMarginGuides,
        setMargins,
        setShowMarginGuides,
    } = useStyleStore();

    if (!isOpen) return null;

    const currentPreset = MARGIN_PRESETS.find(p => p.value === marginTop)?.value ?? null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 modal-overlay modal-open" onClick={onClose}>
            <div
                className="bg-[#161b22] rounded-xl w-[420px] flex flex-col shadow-2xl border border-[#30363d] modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
                    <div className="flex items-center gap-2">
                        <Ruler size={18} className="text-[#388bfd]" />
                        <h2 className="text-lg font-semibold text-[#c9d1d9]">Document Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[#21262d] rounded transition-colors"
                    >
                        <X size={20} className="text-[#8b949e]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Page Margins */}
                    <div>
                        <h3 className="text-sm font-medium text-[#c9d1d9] mb-3">Page Margins</h3>
                        <div className="space-y-2">
                            {MARGIN_PRESETS.map((preset) => (
                                <label
                                    key={preset.value}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                        currentPreset === preset.value
                                            ? 'bg-[#388bfd22] border border-[#388bfd]'
                                            : 'bg-[#21262d] border border-[#30363d] hover:border-[#8b949e]'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="margin-preset"
                                        checked={currentPreset === preset.value}
                                        onChange={() => setMargins({
                                            top: preset.value,
                                            bottom: preset.value,
                                            left: preset.value,
                                            right: preset.value,
                                        })}
                                        className="accent-[#388bfd]"
                                    />
                                    <span className="text-sm text-[#c9d1d9]">{preset.label}</span>
                                    <span className="text-xs text-[#6e7681] ml-auto">{preset.value}px</span>
                                </label>
                            ))}
                        </div>
                        {currentPreset === null && (
                            <p className="text-xs text-[#d29922] mt-2">
                                Custom margins ({marginTop}px) — imported from document
                            </p>
                        )}
                    </div>

                    {/* Margin Guides Toggle */}
                    <div>
                        <label className="flex items-center justify-between px-3 py-2.5 bg-[#21262d] rounded-lg border border-[#30363d] cursor-pointer">
                            <span className="text-sm text-[#c9d1d9]">Show margin guides</span>
                            <input
                                type="checkbox"
                                checked={showMarginGuides}
                                onChange={(e) => setShowMarginGuides(e.target.checked)}
                                className="accent-[#388bfd] w-4 h-4"
                            />
                        </label>
                        <p className="text-[10px] text-[#6e7681] mt-1 px-1">
                            Dashed lines showing margin boundaries (hidden in print)
                        </p>
                    </div>
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

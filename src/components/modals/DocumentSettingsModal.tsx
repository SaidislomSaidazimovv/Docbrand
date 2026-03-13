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
                className="bg-[#f6f8fa] rounded-xl w-[420px] flex flex-col shadow-2xl border border-[#d0d7de] modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#d0d7de]">
                    <div className="flex items-center gap-2">
                        <Ruler size={18} className="text-[#3fb950]" />
                        <h2 className="text-lg font-semibold text-[#1f2328]">Document Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[#eaeef2] rounded transition-colors"
                    >
                        <X size={20} className="text-[#656d76]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Page Margins */}
                    <div>
                        <h3 className="text-sm font-medium text-[#1f2328] mb-3">Page Margins</h3>
                        <div className="space-y-2">
                            {MARGIN_PRESETS.map((preset) => (
                                <label
                                    key={preset.value}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                        currentPreset === preset.value
                                            ? 'bg-[#3fb95022] border border-[#3fb950]'
                                            : 'bg-[#eaeef2] border border-[#d0d7de] hover:border-[#656d76]'
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
                                        className="accent-[#3fb950]"
                                    />
                                    <span className="text-sm text-[#1f2328]">{preset.label}</span>
                                    <span className="text-xs text-[#9198a1] ml-auto">{preset.value}px</span>
                                </label>
                            ))}
                        </div>
                        {currentPreset === null && (
                            <p className="text-xs text-[#9a6700] mt-2">
                                Custom margins ({marginTop}px) — imported from document
                            </p>
                        )}
                    </div>

                    {/* Margin Guides Toggle */}
                    <div>
                        <label className="flex items-center justify-between px-3 py-2.5 bg-[#eaeef2] rounded-lg border border-[#d0d7de] cursor-pointer">
                            <span className="text-sm text-[#1f2328]">Show margin guides</span>
                            <input
                                type="checkbox"
                                checked={showMarginGuides}
                                onChange={(e) => setShowMarginGuides(e.target.checked)}
                                className="accent-[#3fb950] w-4 h-4"
                            />
                        </label>
                        <p className="text-[10px] text-[#9198a1] mt-1 px-1">
                            Dashed lines showing margin boundaries (hidden in print)
                        </p>
                    </div>
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

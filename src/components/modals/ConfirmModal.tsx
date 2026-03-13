'use client';

import { useEffect } from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay ${isOpen ? 'modal-open' : ''}`}
            onClick={onCancel}
        >
            <div
                className="w-full max-w-sm bg-[#f6f8fa] border border-[#d0d7de] rounded-xl shadow-2xl modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-[#1f2328] mb-2">{title}</h3>
                    <p className="text-sm text-[#656d76] mb-6">{message}</p>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm text-[#1f2328] border border-[#d0d7de] rounded-lg hover:bg-[#eaeef2] transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 text-sm text-white bg-[#1a7f37] hover:bg-[#1a8f3e] rounded-lg font-medium transition-colors"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

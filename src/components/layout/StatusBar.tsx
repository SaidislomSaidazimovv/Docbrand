'use client';

import { useEffect, useState } from 'react';
import { FileText, LayoutGrid, Save } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useEditorStore } from '@/store/editorStore';

interface StatusBarProps {
    onOpenShredder?: () => void;
}

export default function StatusBar({ onOpenShredder }: StatusBarProps) {
    const [wordCount, setWordCount] = useState(0);
    const [charCount, setCharCount] = useState(0);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const requirements = useRequirementsStore((state) => state.requirements);
    const editor = useEditorStore((state) => state.editor);

    // Calculate word count from editor
    useEffect(() => {
        if (!editor) return;

        const updateCounts = () => {
            const text = editor.getText().trim();
            const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
            // Count only letters (a-z, A-Z)
            const letters = (text.match(/[a-zA-Z]/g) || []).length;
            setWordCount(words);
            setCharCount(letters);
        };

        // Initial count
        updateCounts();

        // Listen for updates
        editor.on('update', updateCounts);

        return () => {
            editor.off('update', updateCounts);
        };
    }, [editor]);

    // Auto-save effect - save to localStorage
    useEffect(() => {
        if (!editor) return;

        let saveTimeout: NodeJS.Timeout;

        const handleUpdate = () => {
            setSaveStatus('unsaved');

            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                setSaveStatus('saving');

                // Save content to localStorage
                try {
                    const content = editor.getHTML();
                    localStorage.setItem('docbrand-editor-content', content);
                    setSaveStatus('saved');
                    setLastSaved(new Date());
                } catch (error) {
                    console.error('Failed to save:', error);
                    setSaveStatus('unsaved');
                }
            }, 1000); // Auto-save after 1 second of inactivity
        };

        editor.on('update', handleUpdate);

        return () => {
            editor.off('update', handleUpdate);
            clearTimeout(saveTimeout);
        };
    }, [editor]);

    // Load saved content on mount
    useEffect(() => {
        if (!editor) return;

        const savedContent = localStorage.getItem('docbrand-editor-content');
        if (savedContent && savedContent.length > 0) {
            // Only load if editor is empty
            const currentContent = editor.getText().trim();
            if (!currentContent || currentContent === '') {
                editor.commands.setContent(savedContent);
                setLastSaved(new Date());
            }
        }
    }, [editor]);

    // Calculate shredder progress
    const total = requirements.length;
    const complete = requirements.filter((r) => r.kanbanStatus === 'complete').length;
    const inReview = requirements.filter((r) => r.kanbanStatus === 'in_review').length;
    const inProgress = requirements.filter((r) => r.kanbanStatus === 'in_progress').length;
    const progressPercent = total > 0 ? Math.round(((complete + inReview * 0.75 + inProgress * 0.25) / total) * 100) : 0;

    // Estimate page count (roughly 500 words per page)
    const pageCount = Math.max(1, Math.ceil(wordCount / 500));
    const currentPage = 1; // Simplified - could be calculated based on cursor position

    // Get save status text
    const getSaveStatusText = () => {
        switch (saveStatus) {
            case 'saving':
                return 'Saving...';
            case 'unsaved':
                return 'Unsaved';
            case 'saved':
            default:
                return 'Saved';
        }
    };

    return (
        <footer className="h-8 flex items-center justify-between px-4 bg-[#161b22] border-t border-[#30363d] text-[10px] text-[#8b949e]">
            {/* Left - Page and word info */}
            <div className="flex items-center gap-4">
                {wordCount > 0 ? (
                    <>
                        <div className="flex items-center gap-1">
                            <FileText size={10} />
                            <span>
                                Page {currentPage} of {pageCount}
                            </span>
                        </div>
                        <span>|</span>
                        <span>{wordCount.toLocaleString()} words</span>
                        <span>|</span>
                        <span>{charCount.toLocaleString()} letters</span>
                    </>
                ) : (
                    <span className="text-[#6e7681]">No content</span>
                )}
            </div>

            {/* Center - Open RFP Shredder Button */}
            {requirements.length > 0 && (
                <button
                    onClick={onOpenShredder}
                    className="flex items-center gap-2 px-4 py-1 bg-gradient-to-r from-[#238636] to-[#2ea043] hover:from-[#2ea043] hover:to-[#3fb950] text-white rounded-full text-xs font-medium transition-all shadow-lg hover:shadow-xl"
                >
                    <LayoutGrid size={12} />
                    <span>Open RFP Shredder</span>
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                        {progressPercent}%
                    </span>
                </button>
            )}

            {/* Right - Save status */}
            <div className="flex items-center gap-1.5">
                <span
                    className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saved'
                        ? 'bg-[#3fb950]'
                        : saveStatus === 'saving'
                            ? 'bg-[#d29922] animate-pulse'
                            : 'bg-[#8b949e]'
                        }`}
                />
                <span>{getSaveStatusText()}</span>
            </div>
        </footer>
    );
}

'use client';

import { MessageSquare } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export default function FeedbackButton() {
    const openFeedback = useUIStore((s) => s.openFeedback);

    return (
        <button
            onClick={openFeedback}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-[#388bfd] hover:bg-[#2563eb] text-white text-sm font-medium rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-colors duration-200"
        >
            <MessageSquare size={16} />
            Feedback
        </button>
    );
}

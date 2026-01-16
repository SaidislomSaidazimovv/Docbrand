'use client';

import { useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import dynamic from 'next/dynamic';
import data from '@emoji-mart/data';

// Dynamic import to avoid SSR issues
const Picker = dynamic(() => import('@emoji-mart/react').then(mod => mod.default), {
    ssr: false,
    loading: () => <div className="p-4 text-gray-500">Loading...</div>
});

interface EmojiPickerProps {
    editor: Editor | null;
    onClose: () => void;
    position?: { top: number; left: number };
}

interface EmojiData {
    native: string;
    id: string;
    name: string;
}

export default function EmojiPicker({ editor, onClose, position }: EmojiPickerProps) {
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleEmojiSelect = (emoji: EmojiData) => {
        if (editor) {
            editor.chain().focus().insertContent(emoji.native).run();
            onClose();
        }
    };

    return (
        <div
            ref={pickerRef}
            className="fixed z-50 shadow-xl rounded-lg"
            style={{
                top: position?.top ?? 100,
                left: position?.left ?? 100,
            }}
        >
            <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
                maxFrequentRows={2}
            />
        </div>
    );
}

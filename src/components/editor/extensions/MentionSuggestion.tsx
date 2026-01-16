'use client';

import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance } from 'tippy.js';
import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

// Sample users - in production, this would come from your database
const USERS = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
    { id: '3', name: 'Carol White', email: 'carol@example.com' },
    { id: '4', name: 'David Chen', email: 'david@example.com' },
    { id: '5', name: 'Emma Wilson', email: 'emma@example.com' },
];

interface MentionListProps {
    items: typeof USERS;
    command: (item: { id: string; label: string }) => void;
}

interface MentionListRef {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            // Pass label for display text
            props.command({ id: item.id, label: item.name });
        }
    };

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };
    // Reset selected index when items change
    useEffect(() => {
        if (props.items.length > 0) {
            setSelectedIndex(0);
        }
    }, [props.items.length]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }
            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }
            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }
            return false;
        },
    }));

    if (props.items.length === 0) {
        return (
            <div className="mention-list bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                <div className="text-gray-500 text-sm px-3 py-2">No users found</div>
            </div>
        );
    }

    return (
        <div className="mention-list bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]">
            {props.items.map((item, index) => (
                <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 ${index === selectedIndex ? 'bg-gray-100' : ''
                        }`}
                    onClick={() => selectItem(index)}
                >
                    <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium">
                        {item.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.email}</div>
                    </div>
                </button>
            ))}
        </div>
    );
});

MentionList.displayName = 'MentionList';

export const mentionSuggestion: Omit<SuggestionOptions, 'editor'> = {
    char: '@',
    items: ({ query }: { query: string }) => {
        return USERS.filter(user =>
            user.name.toLowerCase().includes(query.toLowerCase()) ||
            user.email.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    },
    render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let popup: Instance[] | null = null;

        return {
            onStart: (props: SuggestionProps) => {
                component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                    getReferenceClientRect: props.clientRect as () => DOMRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                });
            },

            onUpdate(props: SuggestionProps) {
                component?.updateProps(props);

                if (!props.clientRect) return;

                popup?.[0]?.setProps({
                    getReferenceClientRect: props.clientRect as () => DOMRect,
                });
            },

            onKeyDown(props: { event: KeyboardEvent }) {
                if (props.event.key === 'Escape') {
                    popup?.[0]?.hide();
                    return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit() {
                popup?.[0]?.destroy();
                component?.destroy();
            },
        };
    },
};

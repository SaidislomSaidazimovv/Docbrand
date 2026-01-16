'use client';

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { SLASH_COMMANDS, CommandItem } from './extensions/SlashCommands';

interface SlashCommandsMenuProps {
    items: CommandItem[];
    command: (item: CommandItem) => void;
}

export interface SlashCommandsMenuRef {
    onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashCommandsMenu = forwardRef<SlashCommandsMenuRef, SlashCommandsMenuProps>(
    ({ items, command }, ref) => {
        const [selectedIndex, setSelectedIndex] = useState(0);

        const selectItem = useCallback(
            (index: number) => {
                const item = items[index];
                if (item) {
                    command(item);
                }
            },
            [items, command]
        );

        const upHandler = useCallback(() => {
            setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        }, [items.length]);

        const downHandler = useCallback(() => {
            setSelectedIndex((prev) => (prev + 1) % items.length);
        }, [items.length]);

        const enterHandler = useCallback(() => {
            selectItem(selectedIndex);
        }, [selectItem, selectedIndex]);

        useEffect(() => {
            setSelectedIndex(0);
        }, [items]);

        useImperativeHandle(ref, () => ({
            onKeyDown: (event: KeyboardEvent) => {
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

        if (items.length === 0) {
            return (
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl p-3 min-w-[220px]">
                    <p className="text-sm text-[#8b949e]">No commands found</p>
                </div>
            );
        }

        return (
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl overflow-hidden min-w-[280px]">
                <div className="p-2 border-b border-[#30363d]">
                    <p className="text-xs text-[#8b949e] uppercase tracking-wide">Basic blocks</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    {items.map((item, index) => (
                        <button
                            key={item.title}
                            onClick={() => selectItem(index)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${index === selectedIndex
                                    ? 'bg-[#388bfd22] text-[#c9d1d9]'
                                    : 'text-[#8b949e] hover:bg-[#21262d]'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-mono ${index === selectedIndex
                                    ? 'bg-[#388bfd] text-white'
                                    : 'bg-[#21262d] text-[#8b949e]'
                                }`}>
                                {item.icon}
                            </div>
                            <div>
                                <p className="font-medium text-sm">{item.title}</p>
                                <p className="text-xs text-[#6e7681]">{item.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }
);

SlashCommandsMenu.displayName = 'SlashCommandsMenu';

// Suggestion configuration for TipTap
export const getSuggestionItems = ({ query }: { query: string }) => {
    return SLASH_COMMANDS.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
    );
};

export default SlashCommandsMenu;

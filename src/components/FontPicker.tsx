'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { AVAILABLE_FONTS } from '@/lib/fonts';
import { useStyleStore } from '@/store/styleStore';
import type { Editor } from '@tiptap/react';

interface FontPickerProps {
    editor: Editor | null;
}

export default function FontPicker({ editor }: FontPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);

    const { fontFamily, setFontFamily, recentFonts, addRecentFont } = useStyleStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus search input on open
    useEffect(() => {
        if (open) {
            setSearch('');
            setHighlightIdx(-1);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    const isSearching = search.trim().length > 0;

    // Filtered fonts (all fonts filtered by search)
    const filtered = AVAILABLE_FONTS.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );

    // Build flat list for keyboard navigation
    const buildVisibleList = useCallback((): string[] => {
        if (isSearching) {
            return filtered.map(f => f.name);
        }
        // Recently used (deduplicated, only those in AVAILABLE_FONTS)
        const allNames = new Set(AVAILABLE_FONTS.map(f => f.name));
        const recents = recentFonts.filter(f => allNames.has(f));
        const allFonts = AVAILABLE_FONTS.map(f => f.name);
        return [...recents, ...allFonts];
    }, [isSearching, filtered, recentFonts]);

    const visibleList = buildVisibleList();

    const selectFont = (name: string) => {
        setFontFamily(name);
        addRecentFont(name);
        if (editor) {
            editor.chain().focus().selectAll().setFontFamily(name).run();
        }
        setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setOpen(false);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(prev => Math.min(prev + 1, visibleList.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIdx >= 0 && highlightIdx < visibleList.length) {
                selectFont(visibleList[highlightIdx]);
            }
        }
    };

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIdx < 0 || !listRef.current) return;
        const items = listRef.current.querySelectorAll('[data-font-item]');
        items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
    }, [highlightIdx]);

    const fallback = (cat: string) => cat === 'serif' ? ', Times, serif' : ', sans-serif';

    // Recently used section (only when not searching)
    const allNames = new Set(AVAILABLE_FONTS.map(f => f.name));
    const recents = recentFonts.filter(f => allNames.has(f));

    // Track index offset for highlight
    let itemIndex = 0;

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger button */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md text-[13px] text-[#c9d1d9] transition-colors"
                style={{ fontFamily: `'${fontFamily}'` }}
            >
                <span className="truncate">{fontFamily}</span>
                <ChevronDown size={14} className="text-[#8b949e] shrink-0 ml-1" />
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className="absolute top-full left-0 right-0 mt-1 bg-[#1c2128] border border-[#30363d] rounded-lg shadow-xl z-50 overflow-hidden"
                    onKeyDown={handleKeyDown}
                >
                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#30363d]">
                        <Search size={13} className="text-[#8b949e] shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search fonts..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setHighlightIdx(0); }}
                            className="flex-1 bg-transparent text-[13px] text-[#c9d1d9] placeholder-[#484f58] outline-none"
                        />
                    </div>

                    {/* Font list */}
                    <div ref={listRef} className="max-h-[280px] overflow-y-auto">
                        {!isSearching && recents.length > 0 && (
                            <>
                                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider">
                                    Recently used
                                </div>
                                {recents.map(name => {
                                    const idx = itemIndex++;
                                    const entry = AVAILABLE_FONTS.find(f => f.name === name);
                                    const cat = entry?.category || 'sans-serif';
                                    return (
                                        <button
                                            key={`recent-${name}`}
                                            data-font-item
                                            onClick={() => selectFont(name)}
                                            onMouseEnter={() => setHighlightIdx(idx)}
                                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
                                                idx === highlightIdx ? 'bg-[#30363d]' : 'hover:bg-[#21262d]'
                                            } ${fontFamily === name ? 'text-[#388bfd]' : 'text-[#c9d1d9]'}`}
                                            style={{ fontFamily: `'${name}'${fallback(cat)}` }}
                                        >
                                            <span className="w-4 shrink-0">
                                                {fontFamily === name && <Check size={13} className="text-[#388bfd]" />}
                                            </span>
                                            {name}
                                        </button>
                                    );
                                })}
                                <div className="mx-3 my-1 border-t border-[#30363d]" />
                                <div className="px-3 pt-1 pb-1 text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider">
                                    All fonts
                                </div>
                            </>
                        )}

                        {isSearching && filtered.length === 0 && (
                            <div className="px-3 py-4 text-xs text-[#8b949e] text-center">
                                No fonts match &ldquo;{search}&rdquo;
                            </div>
                        )}

                        {(isSearching ? filtered : AVAILABLE_FONTS).map(f => {
                            const idx = itemIndex++;
                            return (
                                <button
                                    key={`all-${f.name}`}
                                    data-font-item
                                    onClick={() => selectFont(f.name)}
                                    onMouseEnter={() => setHighlightIdx(idx)}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
                                        idx === highlightIdx ? 'bg-[#30363d]' : 'hover:bg-[#21262d]'
                                    } ${fontFamily === f.name ? 'text-[#388bfd]' : 'text-[#c9d1d9]'}`}
                                    style={{ fontFamily: `'${f.name}'${fallback(f.category)}` }}
                                >
                                    <span className="w-4 shrink-0">
                                        {fontFamily === f.name && <Check size={13} className="text-[#388bfd]" />}
                                    </span>
                                    {f.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

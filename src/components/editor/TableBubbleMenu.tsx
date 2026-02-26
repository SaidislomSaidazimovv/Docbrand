'use client';

import { useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
    ArrowUpFromLine, ArrowDownFromLine, Trash2,
    ArrowLeftFromLine, ArrowRightFromLine,
    Combine, SplitSquareVertical, ClipboardList,
} from 'lucide-react';

interface TableBubbleMenuProps {
    editor: Editor;
}

export default function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
    const [showBoe, setShowBoe] = useState(false);
    const [boeValue, setBoeValue] = useState('');

    const canMerge = editor.can().mergeCells();
    const canSplit = editor.can().splitCell();

    const btn =
        'flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 transition-colors';
    const btnDanger =
        'flex items-center justify-center w-7 h-7 rounded hover:bg-red-500/20 transition-colors';
    const btnDisabled =
        'flex items-center justify-center w-7 h-7 rounded opacity-30 cursor-not-allowed';
    const sep = <div className="w-px h-4 bg-white/20 mx-0.5 shrink-0" />;

    // BoE helpers
    const getCurrentBoe = (): string => {
        const attrs = editor.getAttributes('tableCell');
        return (attrs?.basisOfEstimate as string) || '';
    };

    const openBoe = () => {
        setBoeValue(getCurrentBoe());
        setShowBoe(true);
    };

    const saveBoe = () => {
        editor.chain().focus().updateAttributes('tableCell', {
            basisOfEstimate: boeValue || null,
        }).run();
        setShowBoe(false);
    };

    const clearBoe = () => {
        editor.chain().focus().updateAttributes('tableCell', {
            basisOfEstimate: null,
        }).run();
        setBoeValue('');
        setShowBoe(false);
    };

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({ editor: e }) =>
                e.isActive('tableCell') || e.isActive('tableHeader')
            }
            options={{
                placement: 'top',
                offset: { mainAxis: 8 },
            }}
        >
            <div
                className="flex flex-col rounded-md shadow-xl"
                style={{ zIndex: 50 }}
                onMouseDown={(e) => e.preventDefault()}
            >
                {/* Compact dark toolbar */}
                <div className="flex items-center gap-px px-1 py-0.5 bg-[#1F2937] rounded-md">
                    {/* Row: +above, +below, delete */}
                    <button
                        className={btn}
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                        title="Add row above"
                    >
                        <ArrowUpFromLine size={13} className="text-white" />
                    </button>
                    <button
                        className={btn}
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        title="Add row below"
                    >
                        <ArrowDownFromLine size={13} className="text-white" />
                    </button>
                    <button
                        className={btnDanger}
                        onClick={() => editor.chain().focus().deleteRow().run()}
                        title="Delete row"
                    >
                        <span className="text-[10px] font-bold text-red-400">-R</span>
                    </button>

                    {sep}

                    {/* Column: +left, +right, delete */}
                    <button
                        className={btn}
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                        title="Add column left"
                    >
                        <ArrowLeftFromLine size={13} className="text-white" />
                    </button>
                    <button
                        className={btn}
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        title="Add column right"
                    >
                        <ArrowRightFromLine size={13} className="text-white" />
                    </button>
                    <button
                        className={btnDanger}
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                        title="Delete column"
                    >
                        <span className="text-[10px] font-bold text-red-400">-C</span>
                    </button>

                    {sep}

                    {/* Merge / Split */}
                    <button
                        className={canMerge ? btn : btnDisabled}
                        onClick={() => canMerge && editor.chain().focus().mergeCells().run()}
                        title="Merge selected cells"
                    >
                        <Combine size={13} className="text-white" />
                    </button>
                    <button
                        className={canSplit ? btn : btnDisabled}
                        onClick={() => canSplit && editor.chain().focus().splitCell().run()}
                        title="Split cell"
                    >
                        <SplitSquareVertical size={13} className="text-white" />
                    </button>

                    {sep}

                    {/* BoE */}
                    <button
                        className={btn}
                        onClick={openBoe}
                        title="Basis of Estimate"
                    >
                        <ClipboardList size={13} className="text-blue-300" />
                    </button>

                    {sep}

                    {/* Delete table */}
                    <button
                        className={btnDanger}
                        onClick={() => editor.chain().focus().deleteTable().run()}
                        title="Delete table"
                    >
                        <Trash2 size={13} className="text-red-400" />
                    </button>
                </div>

                {/* BoE popover — slides open below dark bar */}
                {showBoe && (
                    <div className="mt-1 bg-white rounded-md shadow-lg border border-gray-200 p-2.5 w-64">
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                            Basis of Estimate
                        </label>
                        <textarea
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-gray-800 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                            rows={2}
                            placeholder='e.g. "GSA rate schedule FY2026"'
                            value={boeValue}
                            onChange={(e) => setBoeValue(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                        <div className="flex justify-end gap-2 mt-1.5">
                            <button
                                className="px-2 py-0.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                                onClick={clearBoe}
                            >
                                Clear
                            </button>
                            <button
                                className="px-2.5 py-0.5 text-[11px] bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                onClick={saveBoe}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </BubbleMenu>
    );
}

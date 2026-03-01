'use client';

import { useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2,
    Combine, SplitSquareVertical, ClipboardList,
} from 'lucide-react';
import posthog from 'posthog-js';

interface TableBubbleMenuProps {
    editor: Editor;
}

export default function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
    const [showBoe, setShowBoe] = useState(false);
    const [boeValue, setBoeValue] = useState('');

    const canMerge = editor.can().mergeCells();
    const canSplit = editor.can().splitCell();

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

    const btn =
        'flex items-center justify-center w-7 h-7 rounded text-gray-600 hover:bg-gray-100 transition-colors duration-100';
    const btnDanger =
        'flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-100';
    const btnDisabled =
        'flex items-center justify-center w-7 h-7 rounded text-gray-300 cursor-not-allowed';
    const sep = <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />;

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
                className="table-bubble-menu flex flex-col"
                style={{ zIndex: 50 }}
                onMouseDown={(e) => e.preventDefault()}
            >
                {/* Main toolbar */}
                <div
                    className="flex items-center gap-0.5 p-1 bg-white rounded-lg border border-gray-200"
                    style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                >
                    {/* Row group */}
                    <button className={btn} onClick={() => { editor.chain().focus().addRowBefore().run(); posthog.capture('table_action', { action: 'add_row' }); }} title="Add row above">
                        <ArrowUp size={14} />
                    </button>
                    <button className={btn} onClick={() => { editor.chain().focus().addRowAfter().run(); posthog.capture('table_action', { action: 'add_row' }); }} title="Add row below">
                        <ArrowDown size={14} />
                    </button>
                    <button className={btnDanger} onClick={() => { editor.chain().focus().deleteRow().run(); posthog.capture('table_action', { action: 'delete_row' }); }} title="Delete row">
                        <Trash2 size={13} />
                    </button>

                    {sep}

                    {/* Column group */}
                    <button className={btn} onClick={() => { editor.chain().focus().addColumnBefore().run(); posthog.capture('table_action', { action: 'add_col' }); }} title="Add column left">
                        <ArrowLeft size={14} />
                    </button>
                    <button className={btn} onClick={() => { editor.chain().focus().addColumnAfter().run(); posthog.capture('table_action', { action: 'add_col' }); }} title="Add column right">
                        <ArrowRight size={14} />
                    </button>
                    <button className={btnDanger} onClick={() => { editor.chain().focus().deleteColumn().run(); posthog.capture('table_action', { action: 'delete_col' }); }} title="Delete column">
                        <Trash2 size={13} />
                    </button>

                    {sep}

                    {/* Merge / Split */}
                    <button
                        className={canMerge ? btn : btnDisabled}
                        onClick={() => { if (canMerge) { editor.chain().focus().mergeCells().run(); posthog.capture('table_action', { action: 'merge' }); } }}
                        title="Merge cells"
                    >
                        <Combine size={14} />
                    </button>
                    <button
                        className={canSplit ? btn : btnDisabled}
                        onClick={() => { if (canSplit) { editor.chain().focus().splitCell().run(); posthog.capture('table_action', { action: 'split' }); } }}
                        title="Split cell"
                    >
                        <SplitSquareVertical size={14} />
                    </button>

                    {sep}

                    {/* BoE */}
                    <button className={`${btn} text-blue-500`} onClick={openBoe} title="Basis of Estimate">
                        <ClipboardList size={14} />
                    </button>

                    {sep}

                    {/* Delete table */}
                    <button className={btnDanger} onClick={() => { editor.chain().focus().deleteTable().run(); posthog.capture('table_action', { action: 'delete_table' }); }} title="Delete table">
                        <Trash2 size={14} className="text-red-400" />
                    </button>
                </div>

                {/* BoE popover */}
                {showBoe && (
                    <div className="mt-1.5 bg-white rounded-lg border border-gray-200 p-3 w-64" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
                            Basis of Estimate
                        </label>
                        <textarea
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-800 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                            rows={2}
                            placeholder='e.g. "GSA rate schedule FY2026"'
                            value={boeValue}
                            onChange={(e) => setBoeValue(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                className="px-2.5 py-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                                onClick={clearBoe}
                            >
                                Clear
                            </button>
                            <button
                                className="px-3 py-1 text-[11px] bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
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

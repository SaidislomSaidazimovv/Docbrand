'use client';

import { useState } from 'react';
import { X, GripVertical, ExternalLink, Edit2 } from 'lucide-react';
import { useRequirementsStore } from '@/store/requirementsStore';
import type { Requirement } from '@/types';

interface ShredderModalProps {
    onClose: () => void;
}

type KanbanStatus = Requirement['kanbanStatus'];

const COLUMNS: { id: KanbanStatus; title: string; color: string }[] = [
    { id: 'to_address', title: 'To Address', color: '#f85149' },
    { id: 'in_progress', title: 'In Progress', color: '#d29922' },
    { id: 'in_review', title: 'In Review', color: '#388bfd' },
    { id: 'complete', title: 'Complete', color: '#3fb950' },
];

export default function ShredderModal({ onClose }: ShredderModalProps) {
    const { requirements, setKanbanStatus } = useRequirementsStore();
    const [draggedReq, setDraggedReq] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);

    // Group requirements by kanban status
    const grouped = COLUMNS.reduce((acc, col) => {
        acc[col.id] = requirements.filter((r) => r.kanbanStatus === col.id);
        return acc;
    }, {} as Record<KanbanStatus, Requirement[]>);

    // Calculate progress
    const total = requirements.length;
    const complete = grouped['complete'].length;
    const inReview = grouped['in_review'].length;
    const inProgress = grouped['in_progress'].length;
    const progressPercent = total > 0 ? Math.round(((complete + inReview * 0.75 + inProgress * 0.25) / total) * 100) : 0;

    // Drag handlers
    const handleDragStart = (reqId: string) => {
        setDraggedReq(reqId);
    };

    const handleDragOver = (e: React.DragEvent, columnId: KanbanStatus) => {
        e.preventDefault();
        setDragOverColumn(columnId);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = (columnId: KanbanStatus) => {
        if (draggedReq) {
            setKanbanStatus(draggedReq, columnId);
        }
        setDraggedReq(null);
        setDragOverColumn(null);
    };

    const handleDragEnd = () => {
        setDraggedReq(null);
        setDragOverColumn(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[95vw] max-w-[1400px] h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-[#1a1a2e] border-b border-[#30363d]">
                    <span className="text-lg font-semibold text-white">RFP Response Progress</span>
                    <div className="flex items-center gap-4">
                        <span className="text-3xl font-bold text-[#3fb950]">{progressPercent}%</span>
                        <button onClick={onClose} className="p-2 hover:bg-[#21262d] rounded-lg transition-colors">
                            <X size={20} className="text-[#8b949e]" />
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-3 bg-[#1a1a2e]">
                    <div className="h-3 bg-[#21262d] rounded-full overflow-hidden flex">
                        {COLUMNS.map((col) => {
                            const count = grouped[col.id].length;
                            const width = total > 0 ? (count / total) * 100 : 0;
                            return (
                                <div
                                    key={col.id}
                                    style={{ width: `${width}%`, backgroundColor: col.color }}
                                    className="transition-all duration-300"
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Column Headers */}
                <div className="flex bg-[#f5f5f5] border-b">
                    {COLUMNS.map((col) => (
                        <div key={col.id} className="flex-1 flex items-center gap-2 px-4 py-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                            <span className="text-sm font-semibold text-gray-700">{col.title}</span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {grouped[col.id].length}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Kanban Board - Using Flexbox */}
                <div className="flex-1 flex overflow-hidden">
                    {COLUMNS.map((col) => (
                        <div
                            key={col.id}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(col.id)}
                            className={`flex-1 p-3 overflow-y-auto border-r last:border-r-0 transition-colors ${dragOverColumn === col.id
                                    ? 'bg-blue-50'
                                    : 'bg-[#fafafa]'
                                }`}
                            style={{ minWidth: '250px' }}
                        >
                            <div className="space-y-3">
                                {grouped[col.id].map((req) => (
                                    <div
                                        key={req.id}
                                        draggable
                                        onDragStart={() => handleDragStart(req.id)}
                                        onDragEnd={handleDragEnd}
                                        className={`p-4 bg-white border border-gray-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${draggedReq === req.id ? 'opacity-50 scale-95' : ''
                                            }`}
                                    >
                                        {/* Req ID and Priority Badge */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                {req.id.slice(-6).toUpperCase()}
                                            </span>
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded ${req.priority === 'mandatory'
                                                        ? 'bg-red-100 text-red-600'
                                                        : 'bg-orange-100 text-orange-600'
                                                    }`}
                                            >
                                                {req.priority}
                                            </span>
                                        </div>

                                        {/* Requirement Text */}
                                        <p className="text-sm text-gray-800 line-clamp-3 mb-3">
                                            {req.originalText.slice(0, 100)}
                                            {req.originalText.length > 100 ? '...' : ''}
                                        </p>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                            <span className="text-xs text-gray-500">
                                                {req.sectionPath[0]}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button className="p-1 hover:bg-gray-100 rounded">
                                                    <Edit2 size={12} className="text-gray-400" />
                                                </button>
                                                <button className="p-1 hover:bg-gray-100 rounded">
                                                    <ExternalLink size={12} className="text-gray-400" />
                                                </button>
                                                <GripVertical size={14} className="text-gray-300" />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Empty state for columns */}
                                {grouped[col.id].length === 0 && (
                                    <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-400 text-sm">
                                        Drag items here
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

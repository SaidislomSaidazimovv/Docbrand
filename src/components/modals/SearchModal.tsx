'use client';

import { useState, useMemo, useCallback } from 'react';
import { X, Search, Sparkles, BookOpen, Check } from 'lucide-react';
import { useLibraryStore, LibraryItem } from '@/store/libraryStore';
import { useEditorStore } from '@/store/editorStore';

interface SearchModalProps {
    onClose: () => void;
}

export default function SearchModal({ onClose }: SearchModalProps) {
    const [query, setQuery] = useState('');
    const [semanticMode, setSemanticMode] = useState(true);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    const { items, incrementUsage } = useLibraryStore();
    const { editor } = useEditorStore();

    // Simple semantic-like search - find related terms
    const getRelatedTerms = useCallback((q: string): string[] => {
        const termMap: Record<string, string[]> = {
            'soc': ['SOC 2', 'SOC 2 Type II', 'security audit'],
            'soc2': ['SOC 2', 'SOC 2 Type II', 'security audit'],
            'security': ['encryption', 'compliance', 'audit'],
            'compliance': ['SOC', 'FedRAMP', 'audit', 'certification'],
            'audit': ['security audit', 'third-party', 'SOC'],
            'encryption': ['AES-256', 'TLS', 'data security'],
            'support': ['SLA', '24/7', 'response time'],
            'implementation': ['timeline', 'deployment', 'project'],
        };

        const lower = q.toLowerCase();
        for (const [key, terms] of Object.entries(termMap)) {
            if (lower.includes(key)) {
                return terms;
            }
        }
        return [];
    }, []);

    // Calculate match score
    const calculateMatchScore = useCallback((item: LibraryItem, q: string): number => {
        if (!q.trim()) return 0;

        const lower = q.toLowerCase();
        const words = lower.split(/\s+/).filter(w => w.length > 2);

        let score = 0;
        const searchText = `${item.title} ${item.content} ${item.tags.join(' ')} ${item.category}`.toLowerCase();

        // Exact match in title
        if (item.title.toLowerCase().includes(lower)) score += 50;

        // Word matches
        for (const word of words) {
            if (item.title.toLowerCase().includes(word)) score += 30;
            if (item.content.toLowerCase().includes(word)) score += 20;
            if (item.tags.some(t => t.toLowerCase().includes(word))) score += 25;
        }

        // Semantic matches (related terms)
        if (semanticMode) {
            const relatedTerms = getRelatedTerms(q);
            for (const term of relatedTerms) {
                if (searchText.includes(term.toLowerCase())) score += 15;
            }
        }

        // Normalize to 0-100
        return Math.min(100, Math.max(0, Math.round(score)));
    }, [semanticMode, getRelatedTerms]);

    // Search results
    const results = useMemo(() => {
        if (!query.trim()) return [];

        return items
            .map(item => ({
                ...item,
                matchScore: calculateMatchScore(item, query),
            }))
            .filter(item => item.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10);
    }, [items, query, calculateMatchScore]);

    // Related terms for display
    const relatedTerms = useMemo(() => getRelatedTerms(query), [query, getRelatedTerms]);

    // Found matches (unique tags from results)
    const foundMatches = useMemo(() => {
        const tags = new Set<string>();
        results.forEach(r => r.tags.forEach(t => tags.add(t)));
        return Array.from(tags).slice(0, 5);
    }, [results]);

    // Toggle selection
    const toggleSelection = (id: string) => {
        setSelectedItems(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    // Insert selected items into editor
    const handleInsertSelected = () => {
        if (!editor || selectedItems.length === 0) return;

        const selectedContent = items
            .filter(item => selectedItems.includes(item.id))
            .map(item => item.content)
            .join('\n\n');

        // Update usage count for all selected items
        selectedItems.forEach(id => incrementUsage(id));

        editor.chain().focus().insertContent(selectedContent).run();
        onClose();
    };

    // Format time ago
    const getTimeAgo = (timestamp: number | null): string => {
        if (!timestamp) return '';
        const days = Math.floor((Date.now() - timestamp) / 86400000);
        if (days === 0) return 'Fresh';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return `${Math.floor(days / 7)} weeks ago`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[700px] max-h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Search Header */}
                <div className="p-4 border-b flex items-center gap-3">
                    <Search size={20} className="text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search content library..."
                        className="flex-1 text-lg outline-none bg-transparent text-gray-800 placeholder-gray-400"
                        autoFocus
                    />
                    <button
                        onClick={() => setSemanticMode(!semanticMode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${semanticMode
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <Sparkles size={14} />
                        Semantic
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Semantic suggestions */}
                {semanticMode && relatedTerms.length > 0 && (
                    <div className="px-4 py-2 bg-purple-50 text-sm">
                        <span className="text-purple-600">
                            <Sparkles size={12} className="inline mr-1" />
                            Also searching for:{' '}
                        </span>
                        <span className="text-purple-800">
                            {relatedTerms.map((term, i) => (
                                <span key={term}>
                                    &quot;{term}&quot;
                                    {i < relatedTerms.length - 1 && ', '}
                                </span>
                            ))}
                        </span>
                    </div>
                )}

                {/* Found matches tags */}
                {foundMatches.length > 0 && (
                    <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">Found matches for:</span>
                        {foundMatches.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Results */}
                <div className="flex-1 overflow-y-auto">
                    {results.length > 0 ? (
                        <>
                            {/* Results header */}
                            <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={16} className="text-blue-600" />
                                    <span className="font-medium text-gray-800">Library Results</span>
                                </div>
                                <span className="text-sm text-gray-500">{results.length} matches</span>
                            </div>

                            {/* Result items */}
                            <div className="divide-y">
                                {results.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleSelection(item.id)}
                                        className={`p-4 cursor-pointer transition-colors ${selectedItems.includes(item.id)
                                            ? 'bg-blue-50'
                                            : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {selectedItems.includes(item.id) && (
                                                        <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                                                            <Check size={14} className="text-white" />
                                                        </div>
                                                    )}
                                                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                                    {item.content}
                                                </p>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-orange-400 rounded-full" />
                                                        {item.category}
                                                    </span>
                                                    <span className="text-gray-400">
                                                        Used {item.usageCount} times
                                                    </span>
                                                    {item.lastUsed && (
                                                        <span className="text-green-600 font-medium">
                                                            {getTimeAgo(item.lastUsed)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-sm font-semibold ${item.matchScore >= 90 ? 'text-green-600' :
                                                item.matchScore >= 70 ? 'text-blue-600' :
                                                    'text-orange-600'
                                                }`}>
                                                {item.matchScore}% match
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : query.trim() ? (
                        <div className="p-8 text-center text-gray-500">
                            <Search size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No results found for &quot;{query}&quot;</p>
                            <p className="text-sm mt-1">Try different keywords or enable semantic search</p>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Start typing to search your content library</p>
                            <p className="text-sm mt-1">Try: &quot;SOC2 compliance&quot;, &quot;security&quot;, &quot;support SLA&quot;</p>
                        </div>
                    )}
                </div>

                {/* Footer with Insert button */}
                {selectedItems.length > 0 && (
                    <div className="p-4 border-t bg-gray-50 flex justify-end">
                        <button
                            onClick={handleInsertSelected}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Insert Selected ({selectedItems.length})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

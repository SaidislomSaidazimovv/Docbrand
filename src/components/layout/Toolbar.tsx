'use client';

import { useState } from 'react';
import {
    Menu,
    FileText,
    Search,
    Upload,
    Download,
    Settings,
    ChevronDown,
    FileDown,
    FilePlus,
    Save,
    Undo,
    Redo,
    Scissors,
    Copy,
    Clipboard,
    ZoomIn,
    ZoomOut,
    Maximize,
    Sparkles,
    CheckSquare,
    PanelLeftClose,
    PanelRightClose,
    Trash2,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useRequirementsStore } from '@/store/requirementsStore';
import { useSourcesStore } from '@/store/sourcesStore';
import { useUIStore } from '@/store/uiStore';
import { useHistoryStore } from '@/store/historyStore';

interface ToolbarProps {
    documentTitle?: string;
    onImportClick?: () => void;
    onExportClick?: () => void;
    onSearchClick?: () => void;
    onSettingsClick?: () => void;
}

type MenuType = 'file' | 'edit' | 'view' | 'tools' | null;

export default function Toolbar({
    documentTitle = 'Technical Proposal - DOJ-2024-RFP-045',
    onImportClick,
    onExportClick,
    onSearchClick,
    onSettingsClick,
}: ToolbarProps) {
    const [openMenu, setOpenMenu] = useState<MenuType>(null);
    const editor = useEditorStore((state) => state.editor);

    // Requirements store
    const requirements = useRequirementsStore((state) => state.requirements);
    const clearRequirements = useRequirementsStore((state) => state.clearRequirements);

    // Sources store
    const sources = useSourcesStore((state) => state.sources);
    const clearSources = useSourcesStore((state) => state.clearSources);

    // UI store
    const { toggleLeftSidebar, toggleRightSidebar, leftSidebarOpen, rightSidebarOpen } = useUIStore();

    // History store
    const addToHistory = useHistoryStore((state) => state.addToHistory);

    const toggleMenu = (menu: MenuType) => {
        setOpenMenu(openMenu === menu ? null : menu);
    };

    const closeMenus = () => setOpenMenu(null);

    // Menu Actions
    const handleNewDocument = () => {
        if (editor && confirm('Create new document? This will clear current content.')) {
            editor.commands.clearContent();
            clearRequirements();
            clearSources();
        }
        closeMenus();
    };

    // Clear All - saves to history before clearing
    const handleClearAll = () => {
        if (requirements.length === 0 && sources.length === 0) {
            alert('Nothing to clear.');
            closeMenus();
            return;
        }

        if (confirm('Clear all imported data? This will be saved to history.')) {
            // Save to history before clearing
            const linkedCount = requirements.filter(r => r.status === 'linked').length;
            addToHistory({
                sources: [...sources],
                requirements: [...requirements],
                linkedCount,
                totalCount: requirements.length,
            });

            // Clear everything
            clearRequirements();
            clearSources();
            if (editor) {
                editor.commands.clearContent();
            }
        }
        closeMenus();
    };

    const handleUndo = () => {
        editor?.chain().focus().undo().run();
        closeMenus();
    };

    const handleRedo = () => {
        editor?.chain().focus().redo().run();
        closeMenus();
    };

    const handleZoomIn = () => {
        document.body.style.zoom = `${(parseFloat(document.body.style.zoom || '1') + 0.1)}`;
        closeMenus();
    };

    const handleZoomOut = () => {
        document.body.style.zoom = `${Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1)}`;
        closeMenus();
    };

    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
        closeMenus();
    };

    return (
        <header className="h-12 flex items-center justify-between px-4 bg-[#161b22] border-b border-[#30363d] relative z-50">
            {/* Left section - Sidebar toggle, Menu and navigation */}
            <div className="flex items-center gap-4">
                {/* Left Sidebar Toggle */}
                <button
                    onClick={toggleLeftSidebar}
                    className="p-1.5 hover:bg-[#21262d] rounded transition-colors"
                    title={leftSidebarOpen ? 'Hide Left Panel' : 'Show Left Panel'}
                >
                    <PanelLeftClose size={18} className={leftSidebarOpen ? 'text-[#388bfd]' : 'text-[#8b949e]'} />
                </button>

                <button className="p-1.5 hover:bg-[#21262d] rounded transition-colors">
                    <Menu size={18} className="text-[#8b949e]" />
                </button>

                <nav className="flex items-center gap-1 text-sm text-[#8b949e] relative">
                    {/* File Menu */}
                    <div className="relative">
                        <button
                            onClick={() => toggleMenu('file')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors ${openMenu === 'file' ? 'bg-[#21262d] text-[#c9d1d9]' : 'hover:bg-[#21262d]'
                                }`}
                        >
                            File
                            <ChevronDown size={12} />
                        </button>
                        {openMenu === 'file' && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[#21262d] rounded-lg shadow-xl border border-[#30363d] py-1 z-50">
                                <button onClick={handleNewDocument} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <FilePlus size={14} />
                                    New Document
                                </button>
                                <button onClick={() => { onImportClick?.(); closeMenus(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Upload size={14} />
                                    Import RFP...
                                </button>
                                <button onClick={closeMenus} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Save size={14} />
                                    Save
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl+S</span>
                                </button>
                                <hr className="border-[#30363d] my-1" />
                                <button onClick={() => { onExportClick?.(); closeMenus(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <FileDown size={14} />
                                    Export...
                                </button>
                                <hr className="border-[#30363d] my-1" />
                                <button onClick={handleClearAll} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#f85149] hover:bg-[#30363d]">
                                    <Trash2 size={14} />
                                    Clear All
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Edit Menu */}
                    <div className="relative">
                        <button
                            onClick={() => toggleMenu('edit')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors ${openMenu === 'edit' ? 'bg-[#21262d] text-[#c9d1d9]' : 'hover:bg-[#21262d]'
                                }`}
                        >
                            Edit
                            <ChevronDown size={12} />
                        </button>
                        {openMenu === 'edit' && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[#21262d] rounded-lg shadow-xl border border-[#30363d] py-1 z-50">
                                <button onClick={handleUndo} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Undo size={14} />
                                    Undo
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl+Z</span>
                                </button>
                                <button onClick={handleRedo} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Redo size={14} />
                                    Redo
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl+Y</span>
                                </button>
                                <hr className="border-[#30363d] my-1" />
                                <button onClick={closeMenus} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Scissors size={14} />
                                    Cut
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl+X</span>
                                </button>
                                <button onClick={closeMenus} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Copy size={14} />
                                    Copy
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl+C</span>
                                </button>
                                <button onClick={closeMenus} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Clipboard size={14} />
                                    Paste
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl+V</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* View Menu */}
                    <div className="relative">
                        <button
                            onClick={() => toggleMenu('view')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors ${openMenu === 'view' ? 'bg-[#21262d] text-[#c9d1d9]' : 'hover:bg-[#21262d]'
                                }`}
                        >
                            View
                            <ChevronDown size={12} />
                        </button>
                        {openMenu === 'view' && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[#21262d] rounded-lg shadow-xl border border-[#30363d] py-1 z-50">
                                <button onClick={handleZoomIn} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <ZoomIn size={14} />
                                    Zoom In
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl++</span>
                                </button>
                                <button onClick={handleZoomOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <ZoomOut size={14} />
                                    Zoom Out
                                    <span className="ml-auto text-[#8b949e] text-xs">Ctrl+-</span>
                                </button>
                                <hr className="border-[#30363d] my-1" />
                                <button onClick={handleFullscreen} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Maximize size={14} />
                                    Full Screen
                                    <span className="ml-auto text-[#8b949e] text-xs">F11</span>
                                </button>
                                <hr className="border-[#30363d] my-1" />
                                <button onClick={() => { toggleLeftSidebar(); closeMenus(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <PanelLeftClose size={14} />
                                    {leftSidebarOpen ? 'Hide' : 'Show'} Left Sidebar
                                </button>
                                <button onClick={() => { toggleRightSidebar(); closeMenus(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <PanelRightClose size={14} />
                                    {rightSidebarOpen ? 'Hide' : 'Show'} Right Sidebar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tools Menu */}
                    <div className="relative">
                        <button
                            onClick={() => toggleMenu('tools')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors ${openMenu === 'tools' ? 'bg-[#21262d] text-[#c9d1d9]' : 'hover:bg-[#21262d]'
                                }`}
                        >
                            Tools
                            <ChevronDown size={12} />
                        </button>
                        {openMenu === 'tools' && (
                            <div className="absolute top-full left-0 mt-1 w-52 bg-[#21262d] rounded-lg shadow-xl border border-[#30363d] py-1 z-50">
                                <button onClick={closeMenus} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <Sparkles size={14} />
                                    Quality Scan
                                </button>
                                <button onClick={closeMenus} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <CheckSquare size={14} />
                                    Check Requirements
                                </button>
                                <hr className="border-[#30363d] my-1" />
                                <button onClick={() => {
                                    const text = editor?.getText() || '';
                                    const words = text.split(/\s+/).filter(Boolean).length;
                                    const chars = text.length;
                                    alert(`Word Count: ${words}\nCharacter Count: ${chars}`);
                                    closeMenus();
                                }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c9d1d9] hover:bg-[#30363d]">
                                    <FileText size={14} />
                                    Word Count
                                </button>
                            </div>
                        )}
                    </div>
                </nav>
            </div>

            {/* Center section - Document title (only show when file imported) */}
            {sources.length > 0 && (
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[#8b949e]" />
                    <span className="text-sm font-medium text-[#c9d1d9]">
                        {sources[0].filename.replace(/\.(pdf|docx)$/i, '')}
                    </span>
                </div>
            )}

            {/* Right section - Actions */}
            <div className="flex items-center gap-2">
                {/* Paste Firewall indicator */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#3fb95022] rounded text-xs text-[#3fb950]">
                    <span className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-pulse" />
                    Paste Firewall Active
                </div>

                <button onClick={onSearchClick} className="p-2 hover:bg-[#21262d] rounded transition-colors">
                    <Search size={16} className="text-[#8b949e]" />
                </button>

                <button
                    onClick={onImportClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#21262d] rounded text-sm text-[#8b949e] transition-colors"
                >
                    <Upload size={14} />
                    Import RFP
                </button>

                <button
                    onClick={onExportClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] rounded text-sm text-white font-medium transition-colors"
                >
                    <Download size={14} />
                    Export
                </button>

                <button
                    onClick={onSettingsClick}
                    className="p-2 hover:bg-[#21262d] rounded transition-colors"
                    title="Settings"
                >
                    <Settings size={16} className="text-[#8b949e]" />
                </button>

                {/* Right Sidebar Toggle */}
                <button
                    onClick={toggleRightSidebar}
                    className="p-1.5 hover:bg-[#21262d] rounded transition-colors"
                    title={rightSidebarOpen ? 'Hide Right Panel' : 'Show Right Panel'}
                >
                    <PanelRightClose size={18} className={rightSidebarOpen ? 'text-[#388bfd]' : 'text-[#8b949e]'} />
                </button>
            </div>

            {/* Click outside to close menus */}
            {openMenu && (
                <div className="fixed inset-0 z-40" onClick={closeMenus} />
            )}
        </header>
    );
}

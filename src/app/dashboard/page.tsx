'use client';

import { useState, useEffect } from 'react';
import posthog from 'posthog-js';
import Toolbar from '@/components/layout/Toolbar';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import StatusBar from '@/components/layout/StatusBar';
import Editor from '@/components/editor/Editor';
import ImportModal from '@/components/modals/ImportModal';
import ExportModal from '@/components/modals/ExportModal';
import HeaderFooterModal from '@/components/modals/HeaderFooterModal';
import ShredderModal from '@/components/modals/ShredderModal';
import SearchModal from '@/components/modals/SearchModal';
import SettingsModal from '@/components/modals/SettingsModal';
import DocumentSettingsModal from '@/components/modals/DocumentSettingsModal';
import { useUIStore } from '@/store/uiStore';

export default function Dashboard() {
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showHeaderFooterModal, setShowHeaderFooterModal] = useState(false);
    const [showShredderModal, setShowShredderModal] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showDocSettingsModal, setShowDocSettingsModal] = useState(false);

    const { leftSidebarOpen, rightSidebarOpen } = useUIStore();

    useEffect(() => {
        posthog.capture('session_started', {
            entry_page: window.location.pathname,
            timestamp: new Date().toISOString(),
        });
    }, []);

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            {/* Top Toolbar */}
            <Toolbar
                onImportClick={() => setShowImportModal(true)}
                onExportClick={() => setShowExportModal(true)}
                onSearchClick={() => setShowSearchModal(true)}
                onSettingsClick={() => setShowSettingsModal(true)}
                onDocSettingsClick={() => setShowDocSettingsModal(true)}
            />

            {/* Main Content - 3 Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - RFP Requirements */}
                <div
                    className="sidebar-wrapper"
                    style={{ width: leftSidebarOpen ? 280 : 0 }}
                >
                    <LeftSidebar onImportClick={() => setShowImportModal(true)} />
                </div>

                {/* Center - Editor */}
                <Editor onEditHeaderFooter={() => setShowHeaderFooterModal(true)} />

                {/* Right Sidebar - Scan, Styles, Sources */}
                <div
                    className="sidebar-wrapper"
                    style={{ width: rightSidebarOpen ? 280 : 0 }}
                >
                    <RightSidebar />
                </div>
            </div>

            {/* Bottom Status Bar */}
            <StatusBar onOpenShredder={() => setShowShredderModal(true)} />

            {/* Modals - always rendered for animation */}
            <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
            <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
            <HeaderFooterModal isOpen={showHeaderFooterModal} onClose={() => setShowHeaderFooterModal(false)} />
            <ShredderModal isOpen={showShredderModal} onClose={() => setShowShredderModal(false)} />
            <SearchModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} />
            <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
            <DocumentSettingsModal isOpen={showDocSettingsModal} onClose={() => setShowDocSettingsModal(false)} />
        </div>
    );
}

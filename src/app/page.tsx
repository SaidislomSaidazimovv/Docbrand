'use client';

import { useState } from 'react';
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
import { useUIStore } from '@/store/uiStore';

export default function Home() {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showHeaderFooterModal, setShowHeaderFooterModal] = useState(false);
  const [showShredderModal, setShowShredderModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { leftSidebarOpen, rightSidebarOpen } = useUIStore();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar
        onImportClick={() => setShowImportModal(true)}
        onExportClick={() => setShowExportModal(true)}
        onSearchClick={() => setShowSearchModal(true)}
        onSettingsClick={() => setShowSettingsModal(true)}
      />

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - RFP Requirements */}
        {leftSidebarOpen && (
          <LeftSidebar onImportClick={() => setShowImportModal(true)} />
        )}

        {/* Center - Editor */}
        <Editor onEditHeaderFooter={() => setShowHeaderFooterModal(true)} />

        {/* Right Sidebar - Scan, Styles, Sources */}
        {rightSidebarOpen && <RightSidebar />}
      </div>

      {/* Bottom Status Bar */}
      <StatusBar onOpenShredder={() => setShowShredderModal(true)} />

      {/* Modals */}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
      {showHeaderFooterModal && <HeaderFooterModal onClose={() => setShowHeaderFooterModal(false)} />}
      {showShredderModal && <ShredderModal onClose={() => setShowShredderModal(false)} />}
      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
    </div>
  );
}

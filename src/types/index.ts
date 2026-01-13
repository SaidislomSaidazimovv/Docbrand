// Type definitions for DocBrand

export interface Requirement {
  id: string;
  text: string; // Short display text
  originalText: string; // Full requirement text
  sectionPath: string[];
  status: 'unlinked' | 'partial' | 'linked' | 'ignored';
  kanbanStatus: 'to_address' | 'in_progress' | 'in_review' | 'complete';
  priority: 'mandatory' | 'desired';
  linkedBlockIds: string[]; // TipTap block IDs this is linked to
  source: {
    fileId: string;
    filename: string;
  };
  importedAt: number;
}

export interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'list';
  content: string;
  linkedRequirements: string[];
}

export interface DocumentState {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

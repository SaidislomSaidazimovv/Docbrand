/**
 * Dexie Database Instance
 * 
 * Central IndexedDB database for DocBrand using Dexie.js
 * 
 * @see docs/Skills/dexie/SKILL.md
 * 
 * IMPORTANT: Transaction Safety Rules
 * ❌ WRONG: Async work inside transaction
 *    await db.transaction('rw', db.docs, async () => {
 *      const content = await editor.getJSON(); // BOOM - TransactionInactiveError
 *      await db.docs.put(content);
 *    });
 * 
 * ✅ CORRECT: Prepare outside, commit inside
 *    const prepared = await prepareSnapshot(editor, store);
 *    await db.transaction('rw', db.docs, async () => {
 *      await db.docs.put(prepared); // Pure writes only
 *    });
 */

import Dexie, { Table } from 'dexie';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface DocumentRecord {
    id: string;
    title: string;
    content: string;              // JSON stringified document
    createdAt: number;
    updatedAt: number;
    lastBlockId?: string;         // For selection restore
}

export interface BlockMetaRecord {
    id: string;                   // Composite: docId + blockId
    docId: string;
    blockId: string;
    linkedRequirements: string[];
    provenance?: {
        type: 'library' | 'past-proposal' | 'manual' | 'ai';
        name?: string;
        date?: string;
    };
}

export interface RequirementRecord {
    id: string;
    text: string;
    originalText: string;
    sectionPath: string[];
    status: 'unlinked' | 'partial' | 'linked' | 'ignored';
    kanbanStatus: 'to_address' | 'in_progress' | 'in_review' | 'complete';
    priority: 'mandatory' | 'desired';
    linkedBlockIds: string[];
    source: {
        fileId: string;
        filename: string;
    };
    importedAt: number;
}

export interface LockRecord {
    docId: string;
    tabId: string;
    expiresAt: number;
}

// =============================================================================
// DATABASE CLASS
// =============================================================================

class DocBrandDatabase extends Dexie {
    documents!: Table<DocumentRecord, string>;
    blockMeta!: Table<BlockMetaRecord, string>;
    requirements!: Table<RequirementRecord, string>;
    locks!: Table<LockRecord, string>;

    constructor() {
        super('docbrand');

        this.version(1).stores({
            documents: 'id, updatedAt',
            blockMeta: 'id, docId, blockId',
            requirements: 'id, status, kanbanStatus, [source.fileId]',
            locks: 'docId',
        });
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const db = new DocBrandDatabase();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Commit a prepared snapshot to the database
 * 
 * @example
 * // Prepare data OUTSIDE transaction
 * const docRecord = { id: 'doc-1', content: JSON.stringify(doc), ... };
 * const metaRecords = blocks.map(b => ({ ... }));
 * 
 * // Commit INSIDE transaction (pure writes only)
 * await commitSnapshot({ docRecord, metaRecords, presentBlockIds });
 */
export async function commitSnapshot(prepared: {
    docRecord: DocumentRecord;
    metaRecords: BlockMetaRecord[];
    presentBlockIds: Set<string>;
}): Promise<void> {
    const { docRecord, metaRecords, presentBlockIds } = prepared;
    const docId = docRecord.id;

    await db.transaction('rw', db.documents, db.blockMeta, async () => {
        // 1. Write doc
        await db.documents.put(docRecord);

        // 2. Upsert present blocks
        await db.blockMeta.bulkPut(metaRecords);

        // 3. Delete absent blocks (GARBAGE COLLECTION)
        const allMeta = await db.blockMeta.where('docId').equals(docId).toArray();
        const staleIds = allMeta
            .filter(m => !presentBlockIds.has(m.blockId))
            .map(m => m.id);

        if (staleIds.length > 0) {
            await db.blockMeta.bulkDelete(staleIds);
        }
    });
}

/**
 * Get a document by ID with selection restore support
 */
export async function getDocument(docId: string): Promise<DocumentRecord | undefined> {
    return db.documents.get(docId);
}

/**
 * Get all requirements for a document
 */
export async function getRequirements(fileId?: string): Promise<RequirementRecord[]> {
    if (fileId) {
        return db.requirements.where('source.fileId').equals(fileId).toArray();
    }
    return db.requirements.toArray();
}

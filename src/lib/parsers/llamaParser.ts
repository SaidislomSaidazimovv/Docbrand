/**
 * LlamaParse Document Parser
 *
 * Uses the LlamaParse REST API to convert DOCX/PDF files into structured
 * TipTap/ProseMirror JSON. Preserves document element order (tables
 * interleaved with paragraphs), extracts bold/italic from markdown,
 * and handles HTML tables with colspan/rowspan.
 *
 * Server-only — used in /api/import/parse route.
 */

// ---------------------------------------------------------------------------
// TipTap types
// ---------------------------------------------------------------------------

interface TipTapMark {
    type: string;
    attrs?: Record<string, unknown>;
}

interface TipTapNode {
    type: string;
    attrs?: Record<string, unknown>;
    content?: TipTapNode[];
    text?: string;
    marks?: TipTapMark[];
}

export interface TipTapDoc {
    type: 'doc';
    content: TipTapNode[];
}

export interface LlamaParseResult {
    document: TipTapDoc;
    plainText: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LLAMA_API_BASE = 'https://api.cloud.llamaindex.ai/api/v1/parsing';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90; // 3 minutes max

// ---------------------------------------------------------------------------
// REST API helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFile(
    apiKey: string,
    fileBuffer: ArrayBuffer,
    fileName: string,
): Promise<string> {
    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append('file', blob, fileName);
    // Request markdown result type so each page has an .md field
    formData.append('result_type', 'markdown');
    formData.append('parsing_instruction',
        'Preserve all document structure. Output tables as HTML with colspan and rowspan attributes. ' +
        'Use markdown headings (#, ##, ###) for heading levels. Use markdown lists (- and 1.) for bullet and numbered lists. ' +
        'Preserve bold (**) and italic (*) formatting.');

    const res = await fetch(`${LLAMA_API_BASE}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`LlamaParse upload failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const jobId = data.id || data.job_id;
    if (!jobId) throw new Error('LlamaParse upload response missing job ID');
    return jobId;
}

async function pollUntilDone(apiKey: string, jobId: string): Promise<void> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL_MS);

        const res = await fetch(`${LLAMA_API_BASE}/job/${jobId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        if (!res.ok) {
            throw new Error(`LlamaParse status check failed (${res.status})`);
        }

        const data = await res.json();
        const status = data.status;

        if (status === 'SUCCESS') return;
        if (status === 'ERROR') {
            throw new Error(`LlamaParse parsing failed: ${data.error || 'Unknown error'}`);
        }
        // PENDING or other → keep polling
    }

    throw new Error('LlamaParse parsing timed out after 3 minutes');
}

async function fetchResult(apiKey: string, jobId: string): Promise<string> {
    const res = await fetch(`${LLAMA_API_BASE}/job/${jobId}/result/markdown`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
        throw new Error(`LlamaParse result fetch failed (${res.status})`);
    }

    // Response shape: { markdown: string, job_metadata: {} }
    const data = await res.json();
    return data.markdown || '';
}

// ---------------------------------------------------------------------------
// Markdown → TipTap conversion
// ---------------------------------------------------------------------------

/** Parse inline bold/italic marks from a markdown text segment. */
function parseInlineMarks(text: string): TipTapNode[] {
    const nodes: TipTapNode[] = [];
    // Match ***bold+italic***, **bold**, *italic* in order of specificity
    const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        // Add preceding plain text
        if (match.index > lastIndex) {
            const plain = text.slice(lastIndex, match.index);
            if (plain) nodes.push({ type: 'text', text: plain });
        }

        if (match[2]) {
            // ***bold+italic***
            nodes.push({
                type: 'text',
                text: match[2],
                marks: [{ type: 'bold' }, { type: 'italic' }],
            });
        } else if (match[3]) {
            // **bold**
            nodes.push({
                type: 'text',
                text: match[3],
                marks: [{ type: 'bold' }],
            });
        } else if (match[4]) {
            // *italic*
            nodes.push({
                type: 'text',
                text: match[4],
                marks: [{ type: 'italic' }],
            });
        }

        lastIndex = match.index + match[0].length;
    }

    // Add trailing plain text
    if (lastIndex < text.length) {
        const trailing = text.slice(lastIndex);
        if (trailing) nodes.push({ type: 'text', text: trailing });
    }

    // If no matches at all, return the whole string as a text node
    if (nodes.length === 0 && text) {
        nodes.push({ type: 'text', text });
    }

    return nodes;
}

/** Strip HTML tags from a string, preserving text content. */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

/** Parse an HTML <table> string into a TipTap table node. */
function parseTableHtml(html: string): TipTapNode | null {
    // Extract all <tr> blocks
    const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: TipTapNode[] = [];
    let trMatch: RegExpExecArray | null;
    let rowIndex = 0;

    while ((trMatch = trPattern.exec(html)) !== null) {
        const rowHtml = trMatch[1];
        const cells: TipTapNode[] = [];

        // Extract <th> and <td> cells
        const cellPattern = /<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi;
        let cellMatch: RegExpExecArray | null;

        while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
            const tagName = cellMatch[1].toLowerCase();
            const attrs = cellMatch[2];
            const cellText = stripHtml(cellMatch[3]);

            // Extract colspan and rowspan
            const colspanMatch = attrs.match(/colspan\s*=\s*["']?(\d+)/i);
            const rowspanMatch = attrs.match(/rowspan\s*=\s*["']?(\d+)/i);
            const colspan = colspanMatch ? parseInt(colspanMatch[1]) : 1;
            const rowspan = rowspanMatch ? parseInt(rowspanMatch[1]) : 1;

            const cellType = (tagName === 'th' || rowIndex === 0)
                ? 'tableHeader'
                : 'tableCell';

            const cellNode: TipTapNode = {
                type: cellType,
                attrs: { colspan, rowspan },
                content: [{
                    type: 'paragraph',
                    content: cellText ? parseInlineMarks(cellText) : [{ type: 'text', text: '' }],
                }],
            };

            cells.push(cellNode);
        }

        if (cells.length > 0) {
            rows.push({ type: 'tableRow', content: cells });
        }
        rowIndex++;
    }

    if (rows.length === 0) return null;
    return { type: 'table', content: rows };
}

/** Parse a markdown-style table (| col1 | col2 |) into a TipTap table node. */
function parseMarkdownTable(lines: string[]): TipTapNode | null {
    if (lines.length < 2) return null;

    const rows: TipTapNode[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip separator rows (|---|---|)
        if (/^\|[\s\-:]+\|$/.test(line) || /^\|(\s*-+\s*\|)+$/.test(line)) continue;

        const cellTexts = line
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map(c => c.trim());

        const isHeader = rows.length === 0;
        const cells: TipTapNode[] = cellTexts.map(text => ({
            type: isHeader ? 'tableHeader' : 'tableCell',
            attrs: { colspan: 1, rowspan: 1 },
            content: [{
                type: 'paragraph',
                content: text ? parseInlineMarks(text) : [{ type: 'text', text: '' }],
            }],
        }));

        if (cells.length > 0) {
            rows.push({ type: 'tableRow', content: cells });
        }
    }

    if (rows.length === 0) return null;
    return { type: 'table', content: rows };
}

interface PendingList {
    type: 'bullet' | 'ordered';
    items: TipTapNode[];
}

function flushList(pending: PendingList | null, output: TipTapNode[]): void {
    if (!pending || pending.items.length === 0) return;
    output.push({
        type: pending.type === 'ordered' ? 'orderedList' : 'bulletList',
        content: pending.items,
    });
}

/** Convert concatenated markdown from LlamaParse pages to a TipTap document. */
export function convertMarkdownToTipTap(markdown: string): TipTapDoc {
    const emptyDoc: TipTapDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
    if (!markdown || !markdown.trim()) return emptyDoc;

    const lines = markdown.split('\n');
    const nodes: TipTapNode[] = [];
    let pendingList: PendingList | null = null;
    let inHtmlTable = false;
    let tableHtml = '';
    let mdTableLines: string[] = [];
    let inMdTable = false;


    // Detect repeated header/footer lines (appear on every page)
    const lineFrequency = new Map<string, number>();
    for (const line of lines) {
        const t = line.trim();
        if (t) lineFrequency.set(t, (lineFrequency.get(t) || 0) + 1);
    }

    const isHeaderFooter = (line: string): boolean => {
        const t = line.trim();
        if (!t) return false;
        return (lineFrequency.get(t) || 0) >= 2
            && t.length < 100
            && !t.endsWith('.')
            && !t.endsWith('?')
            && !t.endsWith('!');
    };

    /** Skip horizontal rules from LlamaParse */
    const isHorizontalRule = (line: string): boolean => {
        const t = line.trim();
        return /^[-*_]{3,}\s*$/.test(t);
    };

    /** Detect heading level from a trimmed line. Returns level 1-3 or null. */
    function detectHeadingLevel(line: string): { level: number; text: string } | null {
        // Rule 1: markdown heading syntax (# / ## / ###)
        const mdMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (mdMatch) {
            return { level: mdMatch[1].length, text: mdMatch[2] };
        }

        return null;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // --- HTML table accumulation ---
        if (inHtmlTable) {
            tableHtml += line + '\n';
            if (/<\/table>/i.test(trimmed)) {
                inHtmlTable = false;
                const tableNode = parseTableHtml(tableHtml);
                if (tableNode) {
                    flushList(pendingList, nodes);
                    pendingList = null;
                    nodes.push(tableNode);
                }
                tableHtml = '';
            }
            continue;
        }

        if (/<table/i.test(trimmed)) {
            flushList(pendingList, nodes);
            pendingList = null;
            inHtmlTable = true;
            tableHtml = line + '\n';
            // Check if table closes on the same line
            if (/<\/table>/i.test(trimmed)) {
                inHtmlTable = false;
                const tableNode = parseTableHtml(tableHtml);
                if (tableNode) nodes.push(tableNode);
                tableHtml = '';
            }
            continue;
        }

        // --- Markdown table detection ---
        if (/^\|.+\|$/.test(trimmed)) {
            if (!inMdTable) {
                flushList(pendingList, nodes);
                pendingList = null;
                inMdTable = true;
                mdTableLines = [];
            }
            mdTableLines.push(trimmed);
            continue;
        } else if (inMdTable) {
            // End of markdown table
            inMdTable = false;
            const tableNode = parseMarkdownTable(mdTableLines);
            if (tableNode) nodes.push(tableNode);
            mdTableLines = [];
            // Fall through to process current line
        }

        // --- Skip repeated header/footer lines and horizontal rules ---
        if (isHeaderFooter(trimmed) || isHorizontalRule(trimmed)) {
            continue;
        }

        // --- Empty line ---
        if (!trimmed) {
            flushList(pendingList, nodes);
            pendingList = null;
            continue;
        }

        // --- Heading (Rule 1: # syntax, Rule 2: bold short, Rule 3: ALL CAPS) ---
        const heading = detectHeadingLevel(trimmed);
        if (heading) {
            flushList(pendingList, nodes);
            pendingList = null;
            nodes.push({
                type: 'heading',
                attrs: { level: heading.level },
                content: parseInlineMarks(heading.text),
            });
            continue;
        }

        // --- Bullet list item ---
        const bulletMatch = trimmed.match(/^[\-\*]\s+(.+)$/);
        if (bulletMatch) {
            if (!pendingList || pendingList.type !== 'bullet') {
                flushList(pendingList, nodes);
                pendingList = { type: 'bullet', items: [] };
            }
            pendingList.items.push({
                type: 'listItem',
                content: [{
                    type: 'paragraph',
                    content: parseInlineMarks(bulletMatch[1]),
                }],
            });
            continue;
        }

        // --- Ordered list item ---
        const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
        if (orderedMatch) {
            if (!pendingList || pendingList.type !== 'ordered') {
                flushList(pendingList, nodes);
                pendingList = { type: 'ordered', items: [] };
            }
            pendingList.items.push({
                type: 'listItem',
                content: [{
                    type: 'paragraph',
                    content: parseInlineMarks(orderedMatch[1]),
                }],
            });
            continue;
        }

        // --- Regular paragraph ---
        flushList(pendingList, nodes);
        pendingList = null;
        nodes.push({
            type: 'paragraph',
            content: parseInlineMarks(trimmed),
        });
    }

    // Flush any remaining state
    flushList(pendingList, nodes);
    if (inMdTable && mdTableLines.length > 0) {
        const tableNode = parseMarkdownTable(mdTableLines);
        if (tableNode) nodes.push(tableNode);
    }

    if (nodes.length === 0) return emptyDoc;
    return { type: 'doc', content: nodes };
}

/** Recursively remove empty text nodes that TipTap rejects. */
function removeEmptyTextNodes(node: TipTapNode): TipTapNode {
    if (node.content) {
        node.content = node.content
            .map(child => removeEmptyTextNodes(child))
            .filter(child => {
                if (child.type === 'text') {
                    return child.text !== undefined && child.text !== '';
                }
                return true;
            });
    }
    return node;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a DOCX or PDF file using LlamaParse, returning a TipTap document
 * and plain text for requirements extraction.
 *
 * Requires LLAMA_CLOUD_API_KEY in environment.
 */
export async function parseWithLlama(
    fileBuffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
): Promise<LlamaParseResult> {
    const apiKey = process.env.LLAMA_CLOUD_API_KEY;
    if (!apiKey) {
        throw new Error('LLAMA_CLOUD_API_KEY not configured');
    }

    // Validate mime type
    const allowed = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(mimeType)) {
        throw new Error(`Unsupported file type for LlamaParse: ${mimeType}`);
    }

    // 1. Upload
    const jobId = await uploadFile(apiKey, fileBuffer, fileName);

    // 2. Poll until done
    await pollUntilDone(apiKey, jobId);

    // 3. Fetch result
    const fullMarkdown = await fetchResult(apiKey, jobId);

    if (!fullMarkdown.trim()) {
        return {
            document: { type: 'doc', content: [{ type: 'paragraph' }] },
            plainText: '',
        };
    }

    // 4. Derive plain text by stripping markdown syntax
    const fullText = fullMarkdown
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\|.*\|/g, '')
        .trim();

    // 5. Convert markdown to TipTap and clean empty text nodes
    const rawDoc = convertMarkdownToTipTap(fullMarkdown);
    const document: TipTapDoc = {
        type: 'doc',
        content: rawDoc.content.map(node => removeEmptyTextNodes(node)),
    };

    return { document, plainText: fullText };
}

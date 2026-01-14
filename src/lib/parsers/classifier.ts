/**
 * Requirement Classifier v2
 * 
 * Smart extraction with section grouping and better filtering.
 * - Groups requirements by sections (L.1, M.2, etc.)
 * - Limits text length for readability
 * - Higher confidence threshold
 */

// Deontic keywords that indicate requirements
const DEONTIC_KEYWORDS = [
    'must',
    'shall',
    'required',
    'mandatory',
];

// Action verbs commonly found in requirements
const ACTION_VERBS = [
    'provide',
    'submit',
    'deliver',
    'ensure',
    'maintain',
    'implement',
    'develop',
    'perform',
    'comply',
    'demonstrate',
];

// Section patterns (L.1, M.2, C.3, etc.)
const SECTION_PATTERN = /^([A-Z])\.(\d+)(?:\.(\d+))?/;
const NUMBERED_SECTION = /^(\d+)\.(\d+)(?:\.(\d+))?/;

export interface ClassifiedRequirement {
    text: string;
    shortText: string; // Truncated version for display
    confidence: 'high' | 'medium' | 'low';
    matchedKeywords: string[];
    section?: string;
    sectionName?: string;
    reqId?: string;
}

export interface RequirementSection {
    id: string;
    name: string;
    requirements: ClassifiedRequirement[];
}

// Truncate text for display (max 60 chars)
function truncateText(text: string, maxLength: number = 60): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength - 3).trim() + '...';
}

// Extract section info from text
function extractSection(text: string): { section: string; sectionName: string; reqId: string } | null {
    // Try L.1, M.2 pattern first
    const letterMatch = text.match(SECTION_PATTERN);
    if (letterMatch) {
        const section = `${letterMatch[1]}.${letterMatch[2]}`;
        const subSection = letterMatch[3] ? `.${letterMatch[3]}` : '';
        const reqId = `REQ-${letterMatch[2]}${subSection ? `.${letterMatch[3]}` : `.${Math.floor(Math.random() * 9) + 1}`}`;

        // Try to extract section name
        const nameMatch = text.match(/^[A-Z]\.\d+(?:\.\d+)?\s+(.+?)(?:\.|$)/);
        const sectionName = nameMatch ? truncateText(nameMatch[1], 30) : `Section ${section}`;

        return { section, sectionName, reqId };
    }

    // Try numbered sections (3.1, 4.2.1)
    const numMatch = text.match(NUMBERED_SECTION);
    if (numMatch) {
        const section = `${numMatch[1]}.${numMatch[2]}`;
        const subSection = numMatch[3] ? `.${numMatch[3]}` : '';
        const reqId = `REQ-${numMatch[1]}${subSection ? `.${numMatch[3]}` : `.${numMatch[2]}`}`;

        const nameMatch = text.match(/^\d+\.\d+(?:\.\d+)?\s+(.+?)(?:\.|$)/);
        const sectionName = nameMatch ? truncateText(nameMatch[1], 30) : `Section ${section}`;

        return { section, sectionName, reqId };
    }

    return null;
}

export function classifyRequirement(text: string): ClassifiedRequirement | null {
    // Skip too short or too long text
    if (text.length < 20 || text.length > 500) return null;

    // Skip if mostly numbers/special chars
    const letterRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
    if (letterRatio < 0.5) return null;

    const lowerText = text.toLowerCase();
    const matchedKeywords: string[] = [];

    // Check for deontic keywords (stricter - require full word match)
    for (const keyword of DEONTIC_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(lowerText)) {
            matchedKeywords.push(keyword);
        }
    }

    // Check for action verbs
    for (const verb of ACTION_VERBS) {
        const regex = new RegExp(`\\b${verb}\\b`, 'i');
        if (regex.test(lowerText)) {
            matchedKeywords.push(verb);
        }
    }

    // Extract section info
    const sectionInfo = extractSection(text);

    // Determine confidence based on matches - require at least 1 deontic + 1 action
    const hasDeontic = matchedKeywords.some(k => DEONTIC_KEYWORDS.includes(k));
    const hasAction = matchedKeywords.some(k => ACTION_VERBS.includes(k));

    if (hasDeontic && hasAction) {
        return {
            text,
            shortText: truncateText(text),
            confidence: 'high',
            matchedKeywords,
            ...sectionInfo
        };
    } else if (hasDeontic || (sectionInfo && matchedKeywords.length >= 1)) {
        return {
            text,
            shortText: truncateText(text),
            confidence: 'medium',
            matchedKeywords,
            ...sectionInfo
        };
    }

    // Check for section headers only (e.g., "3.1 Technical Requirements")
    if (sectionInfo && text.length < 100) {
        return {
            text,
            shortText: truncateText(text),
            confidence: 'low',
            matchedKeywords: ['section_header'],
            ...sectionInfo
        };
    }

    return null;
}

export function extractRequirements(paragraphs: { text: string }[]): ClassifiedRequirement[] {
    const requirements: ClassifiedRequirement[] = [];
    const seen = new Set<string>(); // Dedupe
    let reqCounter = 1;

    for (const paragraph of paragraphs) {
        const classified = classifyRequirement(paragraph.text);
        if (classified) {
            // Skip duplicates
            const key = classified.text.substring(0, 50).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            // Assign req ID if not present
            if (!classified.reqId) {
                classified.reqId = `REQ-${reqCounter}`;
            }
            reqCounter++;

            requirements.push(classified);
        }
    }

    // Limit total requirements (max 50)
    const limited = requirements
        .sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 };
            return order[a.confidence] - order[b.confidence];
        })
        .slice(0, 50);

    return limited;
}

// Group requirements by section for hierarchical display
export function groupBySection(requirements: ClassifiedRequirement[]): RequirementSection[] {
    const sectionMap = new Map<string, RequirementSection>();

    for (const req of requirements) {
        const sectionId = req.section || 'uncategorized';
        const sectionName = req.sectionName || 'Uncategorized';

        if (!sectionMap.has(sectionId)) {
            sectionMap.set(sectionId, {
                id: sectionId,
                name: sectionName,
                requirements: []
            });
        }

        sectionMap.get(sectionId)!.requirements.push(req);
    }

    // Convert to array and sort by section ID
    return Array.from(sectionMap.values()).sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true })
    );
}

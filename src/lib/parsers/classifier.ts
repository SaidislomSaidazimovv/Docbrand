/**
 * Requirement Classifier
 * 
 * Analyzes text paragraphs and classifies them as requirements.
 * Uses deontic keywords (must, shall, required) and action verbs.
 */

// Deontic keywords that indicate requirements
const DEONTIC_KEYWORDS = [
    'must',
    'shall',
    'will',
    'required',
    'mandatory',
    'needs to',
    'has to',
    'is required',
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
    'support',
    'include',
];

export interface ClassifiedRequirement {
    text: string;
    confidence: 'high' | 'medium' | 'low';
    matchedKeywords: string[];
}

export function classifyRequirement(text: string): ClassifiedRequirement | null {
    const lowerText = text.toLowerCase();
    const matchedKeywords: string[] = [];

    // Check for deontic keywords
    for (const keyword of DEONTIC_KEYWORDS) {
        if (lowerText.includes(keyword)) {
            matchedKeywords.push(keyword);
        }
    }

    // Check for action verbs
    for (const verb of ACTION_VERBS) {
        if (lowerText.includes(verb)) {
            matchedKeywords.push(verb);
        }
    }

    // Determine confidence based on matches
    if (matchedKeywords.length >= 2) {
        return { text, confidence: 'high', matchedKeywords };
    } else if (matchedKeywords.length === 1) {
        return { text, confidence: 'medium', matchedKeywords };
    }

    // Check for section headers (e.g., "3.1 Technical Requirements")
    if (/^\d+(\.\d+)*\s+[A-Z]/.test(text) && text.length < 100) {
        return { text, confidence: 'low', matchedKeywords: ['section_header'] };
    }

    return null;
}

export function extractRequirements(paragraphs: { text: string }[]): ClassifiedRequirement[] {
    const requirements: ClassifiedRequirement[] = [];

    for (const paragraph of paragraphs) {
        const classified = classifyRequirement(paragraph.text);
        if (classified) {
            requirements.push(classified);
        }
    }

    // Sort by confidence (high first)
    requirements.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.confidence] - order[b.confidence];
    });

    return requirements;
}

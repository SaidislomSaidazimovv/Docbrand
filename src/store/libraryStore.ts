/**
 * Content Library Store - Zustand
 * 
 * Manages reusable content snippets for proposals
 */

import { create } from 'zustand';

export interface LibraryItem {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    usageCount: number;
    lastUsed: number | null;
    createdAt: number;
}

interface LibraryState {
    items: LibraryItem[];
    addItem: (item: Omit<LibraryItem, 'id' | 'usageCount' | 'lastUsed' | 'createdAt'>) => void;
    removeItem: (id: string) => void;
    incrementUsage: (id: string) => void;
}

// Demo content library with common RFP responses
const DEMO_ITEMS: LibraryItem[] = [
    {
        id: 'lib-1',
        title: 'SOC 2 Type II Certification Statement',
        content: 'Our platform maintains SOC 2 Type II certification, audited annually by independent third parties. This certification demonstrates our commitment to security, availability, processing integrity, confidentiality, and privacy.',
        category: 'Security',
        tags: ['SOC 2', 'SOC 2 Type II', 'security audit', 'compliance'],
        usageCount: 47,
        lastUsed: Date.now() - 86400000,
        createdAt: Date.now() - 86400000 * 30,
    },
    {
        id: 'lib-2',
        title: 'Security Compliance Overview',
        content: 'We have achieved and maintained FedRAMP Moderate authorization since 2019, with annual SOC audits confirming our security posture. Our security program includes 24/7 monitoring, incident response, and regular penetration testing.',
        category: 'Security',
        tags: ['FedRAMP', 'SOC', 'security', 'compliance', 'monitoring'],
        usageCount: 32,
        lastUsed: Date.now() - 86400000 * 2,
        createdAt: Date.now() - 86400000 * 60,
    },
    {
        id: 'lib-3',
        title: 'Third-Party Audit Results',
        content: 'Our most recent security audit confirmed zero critical findings across all control areas. We engage independent auditors annually to validate our security controls and compliance posture.',
        category: 'Compliance',
        tags: ['audit', 'security audit', 'third-party', 'compliance'],
        usageCount: 18,
        lastUsed: Date.now() - 86400000 * 5,
        createdAt: Date.now() - 86400000 * 90,
    },
    {
        id: 'lib-4',
        title: 'Data Encryption Standards',
        content: 'All data is encrypted at rest using AES-256 encryption and in transit using TLS 1.3. We maintain strict key management practices with regular key rotation and secure key storage.',
        category: 'Security',
        tags: ['encryption', 'AES-256', 'TLS', 'data security'],
        usageCount: 28,
        lastUsed: Date.now() - 86400000 * 3,
        createdAt: Date.now() - 86400000 * 45,
    },
    {
        id: 'lib-5',
        title: 'Implementation Timeline',
        content: 'Our standard implementation timeline is 8-12 weeks from contract signature to go-live. This includes discovery, configuration, integration, testing, training, and deployment phases.',
        category: 'Implementation',
        tags: ['timeline', 'implementation', 'deployment', 'project'],
        usageCount: 41,
        lastUsed: Date.now() - 86400000,
        createdAt: Date.now() - 86400000 * 120,
    },
    {
        id: 'lib-6',
        title: 'Support SLA Commitment',
        content: 'We provide 24/7 technical support availability with guaranteed response times: Critical issues within 1 hour, High priority within 4 hours, and Medium priority within 8 business hours.',
        category: 'Support',
        tags: ['SLA', 'support', '24/7', 'response time'],
        usageCount: 35,
        lastUsed: Date.now() - 86400000 * 2,
        createdAt: Date.now() - 86400000 * 80,
    },
];

export const useLibraryStore = create<LibraryState>((set) => ({
    items: DEMO_ITEMS,

    addItem: (item) =>
        set((state) => ({
            items: [
                ...state.items,
                {
                    ...item,
                    id: `lib-${Date.now()}`,
                    usageCount: 0,
                    lastUsed: null,
                    createdAt: Date.now(),
                },
            ],
        })),

    removeItem: (id) =>
        set((state) => ({
            items: state.items.filter((item) => item.id !== id),
        })),

    incrementUsage: (id) =>
        set((state) => ({
            items: state.items.map((item) =>
                item.id === id
                    ? { ...item, usageCount: item.usageCount + 1, lastUsed: Date.now() }
                    : item
            ),
        })),
}));

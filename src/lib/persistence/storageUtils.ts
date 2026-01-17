/**
 * Dexie & Browser Storage Utilities
 * 
 * Exactly as specified in docs/Skills/dexie/SKILL.md
 * - Transaction safety patterns
 * - Cross-browser idle scheduling
 * - Storage durability checks
 */

// =============================================================================
// Cross-Browser Idle Scheduling
// =============================================================================

/**
 * Schedule work with cross-browser support
 * - Tier 1: requestIdleCallback (Chrome, Firefox)
 * - Tier 2: requestAnimationFrame (Safari, iOS)
 */
export function scheduleWork(callback: () => void, options = { timeout: 2000 }) {
    // Tier 1: rIC (Chrome, Firefox)
    if ('requestIdleCallback' in window) {
        return (window as any).requestIdleCallback(callback, options);
    }

    // Tier 2: rAF (Safari, iOS)
    // Schedule at end of next frame
    return requestAnimationFrame(() => {
        setTimeout(callback, 0);
    });
}

// Tier 3: Force save every 10s regardless of typing
const MAX_SAVE_INTERVAL = 10000;
let lastSaveTime = Date.now();

export function maybeForceFlush(flushNow: () => void) {
    if (Date.now() - lastSaveTime > MAX_SAVE_INTERVAL) {
        flushNow();
        lastSaveTime = Date.now();
    }
}

export function resetSaveTime() {
    lastSaveTime = Date.now();
}

// =============================================================================
// Storage Durability
// =============================================================================

export interface StorageDurability {
    isPersisted: boolean;
    usage: number;
    quota: number;
    atRisk: boolean;
}

/**
 * Check if storage is durable (not at risk of being cleared)
 */
export async function checkStorageDurability(): Promise<StorageDurability> {
    const persisted = await navigator.storage?.persisted?.() ?? false;
    const estimate = await navigator.storage?.estimate?.() ?? {};

    return {
        isPersisted: persisted,
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
        atRisk: !persisted,
    };
}

// =============================================================================
// Page Lifecycle Flush (Reliability Hierarchy)
// =============================================================================

/**
 * Register page lifecycle flush handlers
 * @param flushNow - Function to call for saving data
 */
export function registerPageLifecycleFlush(flushNow: () => void) {
    // PRIMARY: Always fires reliably
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushNow();
        }
    });

    // SECONDARY: Navigation + bfcache
    window.addEventListener('pagehide', flushNow);

    // BEST EFFORT: May not fire on mobile
    window.addEventListener('beforeunload', flushNow);
}

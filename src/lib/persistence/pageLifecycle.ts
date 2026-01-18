/**
 * Page Lifecycle Flush Handler
 * 
 * Registers handlers for page lifecycle events to ensure data is saved
 * before the page is unloaded or hidden.
 * 
 * @see docs/Skills/dexie/SKILL.md - Page Lifecycle Flush section
 */

'use client';

type FlushCallback = () => void;

/**
 * Register page lifecycle flush handlers
 * 
 * Reliability Hierarchy (per skill documentation):
 * 1. visibilitychange (hidden) — Most reliable
 * 2. pagehide — Works for navigation
 * 3. beforeunload — Best effort only (mobile unreliable)
 */
export function registerPageLifecycleFlush(flushNow: FlushCallback): () => void {
    // PRIMARY: Always fires reliably
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            flushNow();
        }
    };

    // SECONDARY: Navigation + bfcache
    const handlePageHide = () => {
        flushNow();
    };

    // BEST EFFORT: May not fire on mobile
    const handleBeforeUnload = () => {
        flushNow();
    };

    // Register all handlers
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Return cleanup function
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
}

/**
 * Activity-based lease refresh for tab locking
 * 
 * Per skill documentation: Refresh on activity, not timer
 * Background tabs are throttled → timers pause
 */
export function registerActivityRefresh(
    refreshLease: FlushCallback,
    recheckOwnership: FlushCallback
): () => void {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            recheckOwnership(); // May have been stolen
            refreshLease();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
}

import { useEffect } from 'react';

/**
 * iOS Safari PWA URL lock.
 *
 * Why this exists: iOS treats only the manifest's `start_url` as
 * "in PWA standalone mode". The moment the URL changes via `pushState`
 * (which Expo Router does on every tab switch), iOS exits standalone
 * mode and shows the full Safari chrome (top URL bar + bottom toolbar).
 * Going back to `start_url` re-enters standalone — but no flag, no
 * meta tag, no manifest property fixes this.
 *
 * Workaround: monkey-patch `history.pushState` so the URL is silently
 * reverted to a stable anchor right after each navigation. React
 * Navigation has already updated its internal state synchronously,
 * so the correct screen renders. iOS just never sees the URL change.
 *
 * Trade-offs:
 *   - Refresh inside the PWA always lands back on the anchor (acceptable)
 *   - Browser back button less meaningful (acceptable in standalone mode)
 *   - Deep links don't reflect tab state in URL (fine for a private PWA)
 *
 * Only active on iOS PWA. Regular browsers (Safari, Chrome, Android PWA)
 * keep normal pushState behaviour because they don't have this iOS quirk.
 */

interface IOSWindow extends Window {
  navigator: Navigator & { standalone?: boolean };
}

export function useIosPwaUrlLock(stableUrl: string): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as IOSWindow;

    // `navigator.standalone` is the iOS-specific PWA detection. Other
    // platforms (Android, desktop) leave it `undefined`, so they bypass
    // this hack entirely.
    const isIOSPWA = w.navigator.standalone === true;
    if (!isIOSPWA) return;

    const originalPushState = w.history.pushState.bind(w.history);

    w.history.pushState = function (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      // Let Expo Router do its push first — that's how it syncs the
      // URL with React Navigation's internal state.
      originalPushState(data, unused, url);
      // Then immediately revert if the new URL drifted off the anchor.
      // We compare pathnames rather than full URLs so query params /
      // hashes are preserved if Expo Router ever uses them.
      if (w.location.pathname !== stableUrl) {
        w.history.replaceState(null, '', stableUrl);
      }
    };

    return () => {
      // Restore the native pushState in case the layout unmounts (HMR,
      // fast refresh). Avoids stacking multiple monkey-patches.
      w.history.pushState = originalPushState;
    };
  }, [stableUrl]);
}

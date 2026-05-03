import { createContext, useContext, type ReactNode } from 'react';
import type { SPATabName } from '@/src/components/navigation/SPATabBar';

/**
 * Lightweight navigation context for the SPA shell.
 *
 * Components nested anywhere in the tree (avatars in TopBar, status dots
 * in SyncDot, etc.) sometimes need to "navigate" — switch tab, open the
 * history modal — without knowing about Expo Router or routes. This
 * context exposes a tiny imperative API the SPA shell wires up once.
 *
 * Outside the shell (e.g. design-demo route, login pre-shell), the
 * provider isn't present and the hook returns no-ops, so callers don't
 * have to guard.
 */
interface SPANavValue {
  goToTab: (tab: SPATabName) => void;
  showHistory: () => void;
}

const SPANavContext = createContext<SPANavValue | null>(null);

export function SPANavProvider({
  value,
  children,
}: {
  value: SPANavValue;
  children: ReactNode;
}) {
  return <SPANavContext.Provider value={value}>{children}</SPANavContext.Provider>;
}

const noop: SPANavValue = {
  goToTab: () => undefined,
  showHistory: () => undefined,
};

export function useSPANav(): SPANavValue {
  return useContext(SPANavContext) ?? noop;
}

import { useEffect } from 'react';
import { useAppContext } from '@/src/providers/AppProvider';
import {
  FAVICON_AWAKE,
  FAVICON_DEFAULT,
  FAVICON_SLEEPING,
  setDocumentFavicon,
  setDocumentTitle,
} from '@/src/lib/documentMeta';

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Synchronise the browser tab title + favicon with the current app state.
 * - Sleeping in progress  → 🌙 + "Charlie dort — 1h 23m"
 * - Awake (recent wake)   → ☀️ + "Charlie"
 * - Otherwise             → 🌸 + "Charlie's Tracker"
 *
 * Renders nothing.
 */
export function DocumentMetaSync(): null {
  const { currentBaby, activeSession } = useAppContext();

  useEffect(() => {
    if (!currentBaby) {
      setDocumentTitle(null);
      setDocumentFavicon(FAVICON_DEFAULT);
      return;
    }

    if (activeSession?.type === 'sleep') {
      const elapsed = Date.now() - activeSession.startTime;
      setDocumentTitle(`${FAVICON_SLEEPING} ${currentBaby.firstName} dort — ${formatDuration(elapsed)}`);
      setDocumentFavicon(FAVICON_SLEEPING);
      const interval = setInterval(() => {
        const next = Date.now() - activeSession.startTime;
        setDocumentTitle(`${FAVICON_SLEEPING} ${currentBaby.firstName} dort — ${formatDuration(next)}`);
      }, 60_000);
      return () => clearInterval(interval);
    }

    setDocumentTitle(`${currentBaby.firstName} — Carnet`);
    setDocumentFavicon(FAVICON_AWAKE);
  }, [currentBaby, activeSession]);

  return null;
}

/**
 * Web-only utilities for syncing the browser tab (title + favicon) with the
 * current app state. No-op on environments without `document` (RN native).
 */

const DEFAULT_TITLE = "Charlie's Tracker";

/**
 * Set the browser tab title. Pass null/undefined to reset to default.
 */
export function setDocumentTitle(title: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  document.title = title?.trim() ? title : DEFAULT_TITLE;
}

/**
 * Set the browser tab favicon to a data-URL emoji.
 * Encoding an emoji into an SVG keeps things zero-dep and crisp at any zoom.
 */
export function setDocumentFavicon(emoji: string): void {
  if (typeof document === 'undefined') return;
  const svg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>${emoji}</text></svg>`;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = svg;
}

export const FAVICON_DEFAULT = '🌸';
export const FAVICON_SLEEPING = '🌙';
export const FAVICON_AWAKE = '☀️';

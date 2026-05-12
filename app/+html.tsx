import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Web-only HTML root. Runs server-side at build time only — no DOM/browser APIs.
 * Configures PWA install (manifest, theme-color, apple meta) + registers SW.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Lock the scale so pinch-zoom (Android/Chrome) and accidental
            ctrl+/desktop zoom can't break the carnet layout. iOS 10+
            overrides `user-scalable=no` for accessibility, so VoiceOver
            users can still zoom — that's fine and expected. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no"
        />
        <meta name="description" content="Le carnet du quotidien de Charlie." />

        {/* PWA — manifest + theme color (light + dark) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Carnet d'aquarelle — must mirror lightTheme.background / darkTheme.background. */}
        <meta name="theme-color" content="#FAF3E8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1F1814" media="(prefers-color-scheme: dark)" />
        <meta name="application-name" content="Charlie" />

        {/* PWA standalone hints — both old (iOS pre-16.4) and new (iOS 16.4+
            and cross-browser standard) capability meta tags. Apple ignores
            the legacy one on recent iOS versions if `mobile-web-app-capable`
            is missing. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Charlie" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {/* Favicons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />

        <ScrollViewStyleReset />

        {/* Avoid background flicker between dark/light */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />

        {/* Defensive: undo any scroll iOS PWA induces around input focus. */}
        <script dangerouslySetInnerHTML={{ __html: scrollResetSnippet }} />

        {/* Service worker registration — soft fail if unsupported */}
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerSnippet }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Carnet d'aquarelle — mirrors theme.ts background tokens. Avoids the
// FOUC flash of an old palette colour before React mounts.
//
// Lock the document to the viewport. Every scroll inside the app lives
// in a React Native <ScrollView>, so the body itself has no business
// scrolling. iOS Safari PWA was using that latitude to scroll the body
// horizontally when the soft keyboard opened on a focused input — and
// never resetting that offset on dismissal, leaving the entire carnet
// shifted to the right after every typing session.
//
// `position: fixed` + `inset: 0` is the only lock iOS Safari PWA fully
// respects — `overflow: hidden` alone wasn't enough; iOS would still
// nudge the layout sideways when bringing an input into view above the
// keyboard. With the body fixed to the viewport, internal RN
// ScrollViews remain the only place anything can scroll.
const responsiveBackground = `
html, body {
  margin: 0;
  padding: 0;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-overflow-scrolling: auto;
}
body {
  background-color: #FAF3E8;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #1F1814;
  }
}`;

// Even with the body pinned, iOS Safari PWA can momentarily push
// document.scrollingElement / window.scrollX off zero when it ferries an
// input above the soft keyboard. The offset usually sticks until the
// next layout, which is why the carnet appeared shifted after every
// modal typing session. Forcing the scroll back to 0 after every
// keyboard-related event undoes the drift without fighting iOS in real
// time. visualViewport gives us the precise hooks (resize + scroll)
// for keyboard show / hide / orientation changes.
const scrollResetSnippet = `
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  function resetScroll() {
    try {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
      var el = document.scrollingElement || document.documentElement;
      if (el) { el.scrollLeft = 0; el.scrollTop = 0; }
      if (document.body) { document.body.scrollLeft = 0; document.body.scrollTop = 0; }
    } catch (e) { /* swallow */ }
  }
  document.addEventListener('focusin', function () {
    requestAnimationFrame(resetScroll);
    setTimeout(resetScroll, 60);
    setTimeout(resetScroll, 300);
  }, true);
  document.addEventListener('focusout', function () {
    requestAnimationFrame(resetScroll);
    setTimeout(resetScroll, 60);
    setTimeout(resetScroll, 300);
  }, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resetScroll);
    window.visualViewport.addEventListener('scroll', resetScroll);
  }
})();`;

const serviceWorkerSnippet = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* swallow */ });
  });
}`;

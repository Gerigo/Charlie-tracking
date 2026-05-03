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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no"
        />
        <meta name="description" content="Le carnet du quotidien de Charlie." />

        {/* PWA — manifest + theme color (light + dark) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Carnet d'aquarelle — must mirror lightTheme.background / darkTheme.background. */}
        <meta name="theme-color" content="#FAF3E8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1F1814" media="(prefers-color-scheme: dark)" />
        <meta name="application-name" content="Charlie" />

        {/* iOS standalone install hints */}
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

        {/* Service worker registration — soft fail if unsupported */}
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerSnippet }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Carnet d'aquarelle — mirrors theme.ts background tokens. Avoids the
// FOUC flash of an old palette colour before React mounts.
const responsiveBackground = `
body {
  background-color: #FAF3E8;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #1F1814;
  }
}`;

const serviceWorkerSnippet = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* swallow */ });
  });
}`;

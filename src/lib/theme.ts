// Charlie design tokens — ported from the Claude Design handoff.
// The app uses the "sage" palette by default (palette switch comes later).

export interface Palette {
  bg: string;
  surface: string;
  soft: string;
  line: string;
  mid: string;
  olive: string;
  ink: string;
  inkSoft: string;
  name: string;
}

// "sage" pointe sur les variables CSS (voir index.css : :root / .dark) pour
// que le toggle clair/sombre s'applique partout sans toucher aux composants.
export const PALETTES: Record<"sage" | "cream" | "mist", Palette> = {
  sage: {
    bg: "var(--p-bg)",
    surface: "var(--p-surface)",
    soft: "var(--p-soft)",
    line: "var(--p-line)",
    mid: "var(--p-mid)",
    olive: "var(--p-olive)",
    ink: "var(--p-ink)",
    inkSoft: "var(--p-ink-soft)",
    name: "Sauge",
  },
  cream: {
    bg: "#F5EFE6",
    surface: "#FFFFFF",
    soft: "#FBF6EC",
    line: "#E8D8C0",
    mid: "#D4BFA0",
    olive: "#A47E50",
    ink: "#332518",
    inkSoft: "#6E5C45",
    name: "Crème",
  },
  mist: {
    bg: "#ECEEEE",
    surface: "#FFFFFF",
    soft: "#F3F5F4",
    line: "#D4D9D6",
    mid: "#B6BFB9",
    olive: "#7A8782",
    ink: "#1F2625",
    inkSoft: "#5A6562",
    name: "Brume",
  },
};

export interface Tone {
  bg: string;
  ink: string;
  soft: string;
}

// Per-event-type tones (warm earthy + soft pastels on the bone background).
export const TONES: Record<
  "indigo" | "sand" | "rose" | "olive" | "sky" | "clay" | "garden",
  Tone
> = {
  indigo: {
    bg: "var(--t-indigo-bg)",
    ink: "var(--t-indigo-ink)",
    soft: "var(--t-indigo-soft)",
  }, // sommeil
  sand: {
    bg: "var(--t-sand-bg)",
    ink: "var(--t-sand-ink)",
    soft: "var(--t-sand-soft)",
  }, // tétée
  rose: {
    bg: "var(--t-rose-bg)",
    ink: "var(--t-rose-ink)",
    soft: "var(--t-rose-soft)",
  }, // tirage
  olive: {
    bg: "var(--t-olive-bg)",
    ink: "var(--t-olive-ink)",
    soft: "var(--t-olive-soft)",
  }, // couche
  sky: {
    bg: "var(--t-sky-bg)",
    ink: "var(--t-sky-ink)",
    soft: "var(--t-sky-soft)",
  }, // soins
  clay: {
    bg: "var(--t-clay-bg)",
    ink: "var(--t-clay-ink)",
    soft: "var(--t-clay-soft)",
  }, // température
  garden: {
    bg: "var(--t-garden-bg)",
    ink: "var(--t-garden-ink)",
    soft: "var(--t-garden-soft)",
  }, // repas / diversification
};

/** Translucent variant of any color (works with CSS vars). */
export function alpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export const FONT_SANS =
  "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif";
export const FONT_SERIF = "'Instrument Serif', 'Times New Roman', serif";

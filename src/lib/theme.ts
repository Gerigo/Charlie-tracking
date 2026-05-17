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

export const PALETTES: Record<"sage" | "cream" | "mist", Palette> = {
  sage: {
    bg: "#EFEDE8",
    surface: "#FFFFFF",
    soft: "#F6F4EE",
    line: "#DAD4C8",
    mid: "#C6BFAE",
    olive: "#928774",
    ink: "#2A2620",
    inkSoft: "#6B6358",
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
  "indigo" | "sand" | "rose" | "olive" | "sky" | "clay",
  Tone
> = {
  indigo: { bg: "#D8D6E2", ink: "#3A3650", soft: "#EBEAF1" }, // sommeil
  sand: { bg: "#E8DCC4", ink: "#5A4A2E", soft: "#F2EADA" }, // tétée
  rose: { bg: "#E8CFC2", ink: "#5C3E33", soft: "#F2E0D6" }, // tirage
  olive: { bg: "#CFD4BE", ink: "#3F4830", soft: "#E2E5D5" }, // couche
  sky: { bg: "#C8D6DB", ink: "#2E454D", soft: "#DDE6EA" }, // soins
  clay: { bg: "#DEC2B5", ink: "#5A3528", soft: "#EBD4C8" }, // température
};

export const FONT_SANS =
  "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif";
export const FONT_SERIF = "'Instrument Serif', 'Times New Roman', serif";

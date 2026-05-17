import type { SVGProps } from "react";

// ─────────────────────────────────────────────────────────────────────
// iOS-style icon set (SF Symbols-inspired). Single source of truth —
// import from here everywhere. Each icon takes { size, sw, filled }.
// Coherent mapping: a bottle for feed, a drop for pump, a thermometer
// for temperature, etc.
// ─────────────────────────────────────────────────────────────────────

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "stroke"> {
  size?: number;
  sw?: number;
  stroke?: string;
  filled?: boolean;
}

function I({
  size = 24,
  sw = 1.7,
  stroke = "currentColor",
  filled = false,
  children,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── Sleep — moon (zzz) ────────────────────────────────────────────────
export const IconSleep = (p: IconProps) => (
  <I {...p}>
    <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.7 6.7 0 0 0 10.7 10.7z" />
    <path d="M15 4h3.6l-3.6 4h3.6" strokeWidth={(p.sw ?? 1.7) * 0.85} />
  </I>
);
export const IconMoonFilled = (p: IconProps) => (
  <I {...p} filled>
    <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.7 6.7 0 0 0 10.7 10.7z" />
  </I>
);

// ── Feed — baby bottle ────────────────────────────────────────────────
export const IconFeed = (p: IconProps) => (
  <I {...p}>
    <path d="M10 2.6h4l-.6 2.2a3 3 0 0 1-.7 1.2l-.2.2v1" />
    <rect x="8.4" y="7.2" width="7.2" height="14.2" rx="3" />
    <path d="M9 11.4h6M9.4 15h5.2" strokeWidth={(p.sw ?? 1.7) * 0.85} />
  </I>
);

// ── Pump — drop ───────────────────────────────────────────────────────
export const IconPump = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3.2c3 3.7 5.4 6.8 5.4 9.6a5.4 5.4 0 1 1-10.8 0c0-2.8 2.4-5.9 5.4-9.6z" />
    <path
      d="M9.4 13.6a2.8 2.8 0 0 0 2.6 2.6"
      strokeWidth={(p.sw ?? 1.7) * 0.85}
    />
  </I>
);

// ── Diaper ────────────────────────────────────────────────────────────
export const IconDiaper = (p: IconProps) => (
  <I {...p}>
    <path d="M4 7h16v3a8 8 0 0 1-16 0V7z" />
    <path d="M4 7c2.2 0 3.4-1 3.6-3M20 7c-2.2 0-3.4-1-3.6-3" />
    <path d="M9 12.5h6" strokeWidth={(p.sw ?? 1.7) * 0.85} />
  </I>
);

// ── Care — sparkles ───────────────────────────────────────────────────
export const IconCare = (p: IconProps) => (
  <I {...p}>
    <path d="M13 3.5c.7 2.9 1.6 3.8 4.5 4.5-2.9.7-3.8 1.6-4.5 4.5-.7-2.9-1.6-3.8-4.5-4.5 2.9-.7 3.8-1.6 4.5-4.5z" />
    <path d="M7.5 14.5c.4 1.6.9 2.1 2.5 2.5-1.6.4-2.1.9-2.5 2.5-.4-1.6-.9-2.1-2.5-2.5 1.6-.4 2.1-.9 2.5-2.5z" />
  </I>
);

// ── Temperature — thermometer ─────────────────────────────────────────
export const IconTemp = (p: IconProps) => (
  <I {...p}>
    <path d="M10 13.5V5.5a2 2 0 1 1 4 0v8a4 4 0 1 1-4 0z" />
    <path d="M12 9v5.6" strokeWidth={(p.sw ?? 1.7) * 0.85} />
    <circle cx="12" cy="17.5" r="2" fill="currentColor" stroke="none" />
  </I>
);

// ── Clock ─────────────────────────────────────────────────────────────
export const IconClock = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.2V12l3.2 1.9" strokeWidth={(p.sw ?? 1.7) * 0.9} />
  </I>
);

// ── Stop (réveil) ─────────────────────────────────────────────────────
export const IconStop = (p: IconProps) => (
  <I {...p} filled>
    <rect x="6" y="6" width="12" height="12" rx="3" />
  </I>
);

// ── Nav: house / calendar / growth / evolution ───────────────────────
export const IconHome = (p: IconProps) => (
  <I {...p}>
    <path d="M4 11.2 12 4l8 7.2" />
    <path d="M5.6 9.8V19a1.4 1.4 0 0 0 1.4 1.4h3.2v-4.6a1.8 1.8 0 0 1 3.6 0V20.4H17a1.4 1.4 0 0 0 1.4-1.4V9.8" />
  </I>
);
export const IconCalendar = (p: IconProps) => (
  <I {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3v4M16 3v4" strokeWidth={(p.sw ?? 1.7) * 1.05} />
    <circle cx="8" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
  </I>
);
export const IconGrowth = (p: IconProps) => (
  <I {...p}>
    <path d="M4 4v15a1 1 0 0 0 1 1h15" />
    <path d="M7 15.5l3.5-4 3 2.4L20 7" />
    <path d="M16 7h4v4" strokeWidth={(p.sw ?? 1.7) * 0.95} />
  </I>
);
export const IconEvolution = (p: IconProps) => (
  <I {...p}>
    <path d="M4 4v15a1 1 0 0 0 1 1h15" />
    <rect x="7" y="12" width="3" height="5.5" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="12.5" y="8" width="3" height="9.5" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="18" y="14" width="3" height="3.5" rx="1.2" fill="currentColor" stroke="none" />
  </I>
);

// ── Diaper content glyphs ────────────────────────────────────────────
export const IconPipi = (p: IconProps) => (
  <I {...p} filled>
    <path d="M12 3.4c2.6 3.2 4.6 5.9 4.6 8.3a4.6 4.6 0 1 1-9.2 0c0-2.4 2-5.1 4.6-8.3z" />
  </I>
);
export const IconCaca = (p: IconProps) => (
  <I {...p}>
    <path d="M12 4c1 1.4.6 2.8-.5 3.4 1.4.4 2.3 1.3 1.9 2.7 1.9.1 2.8 1.4 2.4 2.8 1.5.1 2.4 1.5 1.9 3H6.3c-.5-1.5.4-2.9 1.9-3-.4-1.4.5-2.7 2.4-2.8-.4-1.4.5-2.3 1.9-2.7-1.1-.6-1.5-2-.5-3.4z" />
  </I>
);

// Easy reuse: name → component map.
export const Icons = {
  sleep: IconSleep,
  moonFilled: IconMoonFilled,
  feed: IconFeed,
  pump: IconPump,
  diaper: IconDiaper,
  care: IconCare,
  temp: IconTemp,
  clock: IconClock,
  stop: IconStop,
  home: IconHome,
  calendar: IconCalendar,
  growth: IconGrowth,
  evolution: IconEvolution,
  pipi: IconPipi,
  caca: IconCaca,
} as const;

export type IconName = keyof typeof Icons;

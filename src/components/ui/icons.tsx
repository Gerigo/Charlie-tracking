import type { SVGProps } from "react";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "stroke"> {
  size?: number;
  sw?: number;
  stroke?: string;
  filled?: boolean;
}

function I({
  size = 24,
  sw = 1.6,
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

export const IconSleep = (p: IconProps) => (
  <I {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </I>
);
export const IconMoonFilled = (p: IconProps) => (
  <I {...p} filled>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </I>
);
export const IconFeed = (p: IconProps) => (
  <I {...p}>
    <path d="M8 3h8" />
    <path d="M9 3v3.5c0 .5-.3.9-.6 1.2A4 4 0 0 0 7 11v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8a4 4 0 0 0-1.4-3.1c-.3-.3-.6-.7-.6-1.2V3" />
    <path d="M7 13h10" />
  </I>
);
export const IconPump = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3.5s-6 6.5-6 10.5a6 6 0 0 0 12 0c0-4-6-10.5-6-10.5z" />
    <path d="M9 14a3 3 0 0 0 3 3" />
  </I>
);
export const IconDiaper = (p: IconProps) => (
  <I {...p}>
    <path d="M4 8h16l-2 8a3 3 0 0 1-3 2H9a3 3 0 0 1-3-2L4 8z" />
    <path d="M4 8c2 0 3-1 3-3M20 8c-2 0-3-1-3-3" />
    <path d="M8 13h8" />
  </I>
);
export const IconCare = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
    <circle cx="12" cy="12" r="2.5" />
  </I>
);
export const IconTemp = (p: IconProps) => (
  <I {...p}>
    <path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z" />
    <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
  </I>
);
export const IconClock = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </I>
);
export const IconStop = (p: IconProps) => (
  <I {...p} filled>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </I>
);
export const IconHome = (p: IconProps) => (
  <I {...p}>
    <path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5h-4V14h-5v7h-4a1.5 1.5 0 0 1-1.5-1.5z" />
  </I>
);
export const IconCalendar = (p: IconProps) => (
  <I {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </I>
);
export const IconGrowth = (p: IconProps) => (
  <I {...p}>
    <path d="M4 19h16" />
    <path d="M4 16l4-5 4 3 4-6 4 4" />
  </I>
);
export const IconEvolution = (p: IconProps) => (
  <I {...p}>
    <path d="M4 20h16" />
    <rect x="6" y="11" width="2.5" height="7" rx="0.5" />
    <rect x="11" y="6" width="2.5" height="12" rx="0.5" />
    <rect x="16" y="13" width="2.5" height="5" rx="0.5" />
  </I>
);
export const IconPipi = (p: IconProps) => (
  <I {...p} filled>
    <path d="M12 3s-5 6-5 10a5 5 0 0 0 10 0c0-4-5-10-5-10z" />
  </I>
);
export const IconCaca = (p: IconProps) => (
  <I {...p}>
    <path d="M12 4c1 1.5.5 3-.5 3.5C13 8 14 9 13.5 10.5c2 0 3 1.5 2.5 3 1.5 0 2.5 1.5 2 3H6c-.5-1.5.5-3 2-3-.5-1.5.5-3 2.5-3-.5-1.5.5-2.5 2-3-1-.5-1.5-2-.5-3.5z" />
  </I>
);

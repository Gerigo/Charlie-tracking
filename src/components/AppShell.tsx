import type { ReactNode } from "react";
import { PALETTES } from "@/lib/theme";

const P = PALETTES.sage;

/** Full-screen app container — no device chrome, desktop and mobile alike. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        background: P.bg,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

import { PALETTES } from "@/lib/theme";

const P = PALETTES.sage;

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${P.line}`,
        borderTopColor: P.olive,
        display: "inline-block",
        animation: "spin 700ms linear infinite",
      }}
    />
  );
}

/** Full-screen generic loader shown while data is loading. */
export function ScreenLoader({ label }: { label?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: P.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        zIndex: 50,
      }}
    >
      <Spinner size={26} />
      {label && (
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: P.inkSoft,
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

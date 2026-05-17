import { useEffect, useState, type ReactNode } from "react";

function StatusBar() {
  const c = "#2A2620";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "21px 28px 0",
        position: "relative",
        zIndex: 20,
      }}
    >
      <span
        style={{
          fontFamily: '-apple-system, "SF Pro", system-ui',
          fontWeight: 590,
          fontSize: 17,
          color: c,
        }}
      >
        9:41
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={c} />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={c} />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={c} />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={c} />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="12"
            rx="3.5"
            stroke={c}
            strokeOpacity="0.35"
            fill="none"
          />
          <rect x="2" y="2" width="20" height="9" rx="2" fill={c} />
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={c} fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Renders children full-screen on phones (≤480px, the PWA target) and inside
 * an iPhone frame on wider screens, matching the Charlie design handoff.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const [framed, setFramed] = useState(
    typeof window !== "undefined" ? window.innerWidth > 480 : false,
  );

  useEffect(() => {
    const onResize = () => setFramed(window.innerWidth > 480);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const content = (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#EFEDE8",
        overflow: "hidden",
      }}
    >
      <StatusBar />
      {children}
    </div>
  );

  if (!framed) {
    return <div style={{ width: "100vw", height: "100dvh" }}>{content}</div>;
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#1F1D1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 402,
          height: 874,
          borderRadius: 48,
          overflow: "hidden",
          position: "relative",
          background: "#EFEDE8",
          boxShadow:
            "0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 126,
            height: 37,
            borderRadius: 24,
            background: "#000",
            zIndex: 50,
          }}
        />
        {content}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            height: 34,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            paddingBottom: 8,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 139,
              height: 5,
              borderRadius: 100,
              background: "rgba(0,0,0,0.25)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

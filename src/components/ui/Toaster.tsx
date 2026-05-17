import { useEffect, useState } from "react";
import {
  dismissToast,
  subscribeToasts,
  type Toast,
} from "@/lib/toast";

const STYLES: Record<
  Toast["type"],
  { bg: string; fg: string; icon: string; ttl: number }
> = {
  success: { bg: "#2F3A2A", fg: "#EAF0E4", icon: "✓", ttl: 2800 },
  info: { bg: "#2A2620", fg: "#F0EEE7", icon: "ℹ", ttl: 2800 },
  error: { bg: "#5A3528", fg: "#F2E0D6", icon: "⚠", ttl: 4500 },
};

function ToastRow({ toast }: { toast: Toast }) {
  const s = STYLES[toast.type];
  useEffect(() => {
    const t = setTimeout(() => dismissToast(toast.id), s.ttl);
    return () => clearTimeout(t);
  }, [toast.id, s.ttl]);
  return (
    <button
      onClick={() => dismissToast(toast.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: 360,
        width: "calc(100vw - 32px)",
        padding: "12px 16px",
        borderRadius: 16,
        background: s.bg,
        color: s.fg,
        fontSize: 13.5,
        fontWeight: 600,
        textAlign: "left",
        boxShadow: "0 10px 30px rgba(20,18,15,0.32)",
        animation: "toastIn 260ms cubic-bezier(0.32,0.72,0.25,1)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "rgba(255,255,255,0.16)",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {s.icon}
      </span>
      <span style={{ flex: 1, lineHeight: 1.35 }}>{toast.message}</span>
    </button>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);
  return (
    <div
      style={{
        position: "absolute",
        top: "max(16px, env(safe-area-inset-top))",
        left: 0,
        right: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastRow toast={t} />
        </div>
      ))}
    </div>
  );
}

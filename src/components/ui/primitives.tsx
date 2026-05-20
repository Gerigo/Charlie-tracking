import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { IconClock } from "@/components/ui/icons";

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 240);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(20,18,15,0.32)",
          opacity: open ? 1 : 0,
          transition: "opacity 240ms ease",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--p-surface)",
          color: "var(--p-ink)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: "0 -10px 40px var(--hairline-strong)",
          maxHeight: "88%",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 280ms cubic-bezier(0.32,0.72,0.25,1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 4px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "var(--hairline-strong)",
            }}
          />
        </div>
        <div style={{ overflow: "auto", flex: 1 }} className="scroll">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        background: "var(--hairline)",
        borderRadius: 999,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "7px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              background: active ? "var(--p-surface)" : "transparent",
              color: active ? "var(--p-ink)" : "var(--p-ink-soft)",
              boxShadow: active ? "0 1px 3px var(--hairline)" : "none",
              transition: "all 180ms ease",
              letterSpacing: "-0.005em",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit = "",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const btn: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 999,
    background: "var(--p-surface)",
    display: "grid",
    placeItems: "center",
    fontSize: 18,
    fontWeight: 500,
    color: "var(--p-ink)",
    boxShadow: "0 1px 2px var(--hairline)",
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--hairline)",
        borderRadius: 999,
        padding: 3,
      }}
    >
      <button
        onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        style={btn}
      >
        −
      </button>
      <span
        className="num"
        style={{
          minWidth: 64,
          textAlign: "center",
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {value}
        {unit}
      </span>
      <button
        onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        style={btn}
      >
        +
      </button>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--p-ink-soft)",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

export function FormHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: "6px 24px 18px" }}>
      <div
        className="serif"
        style={{ fontSize: 27, lineHeight: 1.1, color: "var(--p-ink)" }}
      >
        {title}
      </div>
    </div>
  );
}

export function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--p-surface)",
        border: "1px solid var(--hairline)",
        padding: "12px 14px",
        borderRadius: 12,
      }}
    >
      <IconClock size={17} stroke="currentColor" />
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          padding: 0,
          fontSize: 16,
          fontWeight: 600,
          fontFamily: "inherit",
          color: "var(--p-ink)",
        }}
      />
    </div>
  );
}

export function DateTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--p-surface)",
        border: "1px solid var(--hairline)",
        padding: "12px 14px",
        borderRadius: 12,
      }}
    >
      <IconClock size={17} stroke="currentColor" />
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          padding: 0,
          fontSize: 16,
          fontWeight: 600,
          fontFamily: "inherit",
          color: "var(--p-ink)",
        }}
      />
    </div>
  );
}

export function SubmitBar({
  label = "Enregistrer",
  onClick,
  onDelete,
}: {
  label?: string;
  onClick: () => void | Promise<void>;
  onDelete?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const mounted = useRef(true);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onClick();
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete || busy) return;
    if (!confirmDel) {
      setConfirmDel(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => {
        if (mounted.current) setConfirmDel(false);
      }, 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    onDelete();
  };

  return (
    <div
      style={{
        padding: "14px 24px calc(16px + env(safe-area-inset-bottom))",
        display: "flex",
        gap: 10,
        borderTop: "0.5px solid var(--hairline)",
        marginTop: 14,
        background: "var(--p-surface)",
        boxShadow: "0 -6px 18px rgba(40,38,32,0.05)",
        position: "sticky",
        bottom: 0,
        zIndex: 1,
      }}
    >
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={busy}
          style={{
            height: 52,
            padding: confirmDel ? "0 16px" : "0 20px",
            borderRadius: 16,
            background: confirmDel ? "#9A6B5D" : "rgba(154,107,93,0.12)",
            color: confirmDel ? "#FBFAF6" : "#7A4D3F",
            fontWeight: 700,
            fontSize: confirmDel ? 13.5 : 14,
            opacity: busy ? 0.5 : 1,
            transition: "background 160ms ease, color 160ms ease",
            whiteSpace: "nowrap",
          }}
        >
          {confirmDel ? "Confirmer ?" : "Supprimer"}
        </button>
      )}
      <button
        onClick={handle}
        disabled={busy}
        style={{
          flex: 1,
          height: 52,
          borderRadius: 16,
          background: "var(--p-ink)",
          color: "var(--p-surface)",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "-0.005em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: busy ? 0.7 : 1,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy && (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.35)",
              borderTopColor: "var(--p-surface)",
              animation: "spin 700ms linear infinite",
            }}
          />
        )}
        {busy ? "Enregistrement…" : label}
      </button>
    </div>
  );
}

export function NoteField({
  value,
  onChange,
  placeholder = "Optionnel…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        minHeight: 56,
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--hairline)",
        background: "var(--p-surface)",
        resize: "none",
        fontFamily: "inherit",
        fontSize: 16,
      }}
    />
  );
}

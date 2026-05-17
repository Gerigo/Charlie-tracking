import {
  useEffect,
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
          background: "#FAF9F5",
          color: "#2A2620",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: "0 -10px 40px rgba(0,0,0,0.18)",
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
              background: "rgba(0,0,0,0.18)",
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
        background: "rgba(0,0,0,0.05)",
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
              background: active ? "#fff" : "transparent",
              color: active ? "#2A2620" : "rgba(42,38,32,0.55)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
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
    background: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 18,
    fontWeight: 500,
    color: "#2A2620",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "rgba(0,0,0,0.05)",
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
        color: "rgba(42,38,32,0.5)",
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
        style={{ fontSize: 27, lineHeight: 1.1, color: "#2A2620" }}
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
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        padding: "12px 14px",
        borderRadius: 12,
      }}
    >
      <IconClock size={17} stroke="rgba(42,38,32,0.45)" />
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
          color: "#2A2620",
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
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      style={{
        padding: "14px 24px calc(16px + env(safe-area-inset-bottom))",
        display: "flex",
        gap: 10,
        borderTop: "0.5px solid rgba(0,0,0,0.07)",
        marginTop: 14,
        background: "#FAF9F5",
        boxShadow: "0 -6px 18px rgba(40,38,32,0.05)",
        position: "sticky",
        bottom: 0,
        zIndex: 1,
      }}
    >
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            height: 52,
            padding: "0 20px",
            borderRadius: 16,
            background: "rgba(154,107,93,0.12)",
            color: "#7A4D3F",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Supprimer
        </button>
      )}
      <button
        onClick={onClick}
        style={{
          flex: 1,
          height: 52,
          borderRadius: 16,
          background: "#2A2620",
          color: "#FAF9F5",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
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
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
        resize: "none",
        fontFamily: "inherit",
        fontSize: 16,
      }}
    />
  );
}

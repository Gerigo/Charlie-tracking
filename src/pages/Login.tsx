import { useState, type CSSProperties, type FormEvent } from "react";
import { PALETTES, FONT_SERIF, TONES } from "@/lib/theme";
import { signIn, authErrorMessage } from "@/hooks/useAuth";

const P = PALETTES.sage;

function CharlieAvatar({ size = 76 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${TONES.sand.bg} 0%, ${TONES.clay.bg} 100%)`,
        display: "grid",
        placeItems: "center",
        color: TONES.clay.ink,
        fontWeight: 700,
        fontSize: size * 0.36,
        fontFamily: FONT_SERIF,
        boxShadow:
          "inset 0 0 0 2px rgba(255,255,255,0.5), 0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)",
      }}
    >
      C
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    background: P.soft,
    border: `1px solid ${focused ? P.olive : P.line}`,
    boxShadow: focused ? `0 0 0 3px ${P.olive}22` : "none",
    color: P.ink,
    fontSize: 16,
    fontWeight: 500,
    outline: "none",
    transition: "border 160ms ease, box-shadow 160ms ease",
  };
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: P.inkSoft,
          marginBottom: 7,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: P.bg,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 28px",
        animation: "fadeIn 400ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 36,
        }}
      >
        <CharlieAvatar />
        <div
          className="serif"
          style={{
            fontSize: 46,
            lineHeight: 1,
            color: P.ink,
            marginTop: 20,
            fontWeight: 400,
          }}
        >
          Charlie
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            color: P.inkSoft,
            fontWeight: 500,
          }}
        >
          Le carnet du quotidien
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          background: P.surface,
          borderRadius: 22,
          border: "0.5px solid rgba(0,0,0,0.05)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 10px rgba(40,38,32,0.05)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={busy}
        />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={busy}
        />

        {error && (
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: TONES.clay.ink,
              background: TONES.clay.soft,
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 4,
            height: 52,
            borderRadius: 16,
            background: busy ? P.mid : P.olive,
            color: "#FBFAF6",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: busy ? "default" : "pointer",
            transition: "background 180ms ease",
            boxShadow: "0 4px 14px rgba(146,135,116,0.3)",
          }}
        >
          {busy && (
            <span
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "#FBFAF6",
                animation: "spin 700ms linear infinite",
              }}
            />
          )}
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <div
        style={{
          marginTop: 22,
          textAlign: "center",
          fontSize: 11.5,
          color: P.inkSoft,
          opacity: 0.7,
        }}
      >
        Suivi privé du quotidien de Charlie
      </div>
    </div>
  );
}

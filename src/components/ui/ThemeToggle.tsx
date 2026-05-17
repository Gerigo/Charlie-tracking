import { PALETTES } from "@/lib/theme";
import { toggleThemeMode, useThemeMode } from "@/lib/themeMode";

const P = PALETTES.sage;

export function ThemeToggle() {
  const mode = useThemeMode();
  const dark = mode === "dark";
  return (
    <button
      type="button"
      onClick={toggleThemeMode}
      aria-label={dark ? "Passer en clair" : "Passer en sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: P.surface,
        border: `1px solid ${P.line}`,
        color: P.ink,
        fontSize: 16,
        lineHeight: 1,
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 160ms ease, border-color 160ms ease",
      }}
    >
      <span role="img" aria-hidden>
        {dark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}

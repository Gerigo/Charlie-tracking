import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

const KEY = "charlie-theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

function read(): ThemeMode {
  const saved =
    typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  if (saved === "light" || saved === "dark") return saved;
  return systemPrefersDark() ? "dark" : "light";
}

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", mode === "dark" ? "#1b1a17" : "#efede8");
  }
}

const listeners = new Set<() => void>();
let current: ThemeMode = read();
apply(current);

function emit() {
  for (const l of listeners) l();
}

export function setThemeMode(mode: ThemeMode) {
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore (private mode) */
  }
  apply(mode);
  emit();
}

export function toggleThemeMode() {
  setThemeMode(current === "dark" ? "light" : "dark");
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}

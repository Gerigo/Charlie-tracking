// Tiny global toast store — usable from components AND plain functions.

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let listeners: Listener[] = [];
let seq = 1;

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(l: Listener): () => void {
  listeners.push(l);
  l(toasts);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function pushToast(type: ToastType, message: string): number {
  const id = seq++;
  toasts = [...toasts, { id, type, message }];
  emit();
  return id;
}

export const toast = {
  success: (m: string) => pushToast("success", m),
  error: (m: string) => pushToast("error", m),
  info: (m: string) => pushToast("info", m),
};

/**
 * Awaits an action, shows a success or error toast, and only resolves
 * (running `onOk`) if it succeeded.
 */
export function withToast(
  action: () => Promise<void>,
  successMsg: string,
  onOk?: () => void,
): Promise<void> {
  // Optimiste / "local-first" : la persistance Firestore applique
  // l'écriture localement immédiatement et le listener met l'UI à jour
  // tout de suite. On NE bloque PAS sur l'ACK serveur (qui peut traîner
  // hors-ligne / en long-polling) — sinon l'UI paraît figée et l'utilisateur
  // spamme. On confirme tout de suite et on signale une éventuelle erreur
  // a posteriori (Firestore annule alors l'écriture locale de lui-même).
  onOk?.();
  toast.success(successMsg);
  void action().catch((e) => {
    const msg =
      typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : "Une erreur est survenue.";
    toast.error(msg || "Une erreur est survenue.");
  });
  return Promise.resolve();
}

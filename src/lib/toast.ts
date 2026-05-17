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
export async function withToast(
  action: () => Promise<void>,
  successMsg: string,
  onOk?: () => void,
): Promise<void> {
  try {
    await action();
    toast.success(successMsg);
    onOk?.();
  } catch (e) {
    const msg =
      typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : "Une erreur est survenue.";
    toast.error(msg || "Une erreur est survenue.");
  }
}

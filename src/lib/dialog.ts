/**
 * Imperative dialog API + host registration.
 *
 * Call confirmAction() from anywhere — if a host is mounted (ConfirmDialogHost
 * in the root layout) it renders a themed modal. Otherwise it falls back to
 * window.confirm() so the app keeps working in early-boot edge cases.
 */

export interface ConfirmRequest {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button with the danger color */
  danger?: boolean;
}

type Handler = (req: ConfirmRequest) => void;

let _handler: Handler | null = null;

export function registerDialogHandler(handler: Handler | null): void {
  _handler = handler;
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean; onCancel?: () => void },
): void {
  if (_handler) {
    _handler({ title, message, onConfirm, ...options });
    return;
  }
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  onConfirm();
}

// Promise-based replacement for window.confirm() — same "wait for a yes/no"
// shape callers already expect, but as an app-styled modal instead of a
// native browser dialog (which also can't be styled, can't say "Törlés"
// instead of "OK", and reads as the browser complaining rather than the app
// asking).
import { create } from 'zustand';

export interface ConfirmRequest {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Styles the confirm button as destructive (red) for irreversible actions. */
    danger?: boolean;
    /** Single-button "OK" mode for pure information with no real decision — see alertDialog(). */
    hideCancel?: boolean;
    resolve: (ok: boolean) => void;
}

interface ConfirmState {
    request: ConfirmRequest | null;
}

export const useConfirmStore = create<ConfirmState>()(() => ({
    request: null,
}));

/**
 * await confirmDialog('Biztosan törlöd?', { danger: true }) — resolves true
 * if the user confirms, false if they cancel or dismiss (Escape / backdrop).
 * Only one request is shown at a time; a second call while one is pending
 * replaces it (matches window.confirm's own single-dialog-at-a-time nature).
 */
export function confirmDialog(
    message: string,
    opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean },
): Promise<boolean> {
    return new Promise(resolve => {
        useConfirmStore.setState({ request: { message, ...opts, resolve } });
    });
}

/**
 * A dismissible modal for information with no real yes/no decision — a
 * single "Rendben" button, replacing an alert() whose content is too long or
 * important to trust to an auto-dismissing toast.
 */
export function alertDialog(message: string, confirmLabel = 'Rendben'): Promise<void> {
    return new Promise(resolve => {
        useConfirmStore.setState({
            request: { message, confirmLabel, hideCancel: true, resolve: () => resolve() },
        });
    });
}

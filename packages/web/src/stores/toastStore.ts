// App-wide toast notifications — replaces native alert() calls, which block
// the whole tab and look like a browser error rather than part of the app.
// Planner.tsx's own save/undo toasts predate this and stay as they are (they
// already work, have their own timer/undo-action wiring, and aren't reachable
// from outside Planner); this is for everywhere else. Same visual language
// (.toast / .toast--success / .toast--error, index.css) so both read as one
// system to the user even though they're two separate pieces of state.
import { create } from 'zustand';

export interface ToastItem {
    id: string;
    type: 'success' | 'error';
    text: string;
}

interface ToastState {
    toasts: ToastItem[];
    showToast: (text: string, type?: ToastItem['type']) => void;
    dismissToast: (id: string) => void;
}

const AUTO_DISMISS_MS = 3500;

export const useToastStore = create<ToastState>()((set, get) => ({
    toasts: [],
    showToast: (text, type = 'success') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        set(s => ({ toasts: [...s.toasts, { id, type, text }] }));
        setTimeout(() => get().dismissToast(id), AUTO_DISMISS_MS);
    },
    dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

/** Non-hook access for use outside components (event handlers, utils). */
export const showToast = (text: string, type?: ToastItem['type']) =>
    useToastStore.getState().showToast(text, type);

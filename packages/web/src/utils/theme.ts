// Shared light/dark theme toggle logic — single source of truth for
// App.tsx (dock), Login.tsx and Welcome.tsx.
//
// v3: the color theme (token map, synced) is independent of the animated
// background effect (device-local, see utils/backgroundEffect.ts).

import type { ColorTheme } from '@shared/lib/types';

/** localStorage key remembering the last dark theme variant used */
export const LAST_DARK_THEME_KEY = 'uni-last-dark-theme';

/** Dark theme variants the light/dark toggle can return to.
 *  'dark-glass' is retired but stays listed so a value already persisted in
 *  localStorage is still recognised as "dark" — normalizeDarkTheme maps it. */
export const DARK_THEMES: ColorTheme[] = ['dark', 'dark-glass', 'terminal'];

/** Fold the retired frosted variant into plain dark. */
export function normalizeDarkTheme(theme: ColorTheme): ColorTheme {
    return theme === 'dark-glass' ? 'dark' : theme;
}

export const isLightTheme = (theme: ColorTheme): boolean => theme === 'light';

type ViewTransition = {
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    finished: Promise<void>;
};

/** Wrap a state update in a View Transition if the browser supports it */
export function withViewTransition(update: () => void) {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => ViewTransition };
    if (typeof document !== 'undefined' && doc.startViewTransition) {
        // The browser aborts a transition (InvalidStateError) if the page is
        // hidden, the callback throws, or a new transition interrupts it
        // mid-flight — none of that should surface as an unhandled rejection
        // when all `update` cares about is that the state change happened.
        const transition = doc.startViewTransition(update);
        transition.ready.catch(() => {});
        transition.finished.catch(() => {});
    } else {
        update();
    }
}

/**
 * Toggle between light and the last used dark theme variant,
 * with a smooth view-transition crossfade.
 */
export function toggleLightDark(
    currentTheme: ColorTheme,
    updatePreferences: (p: Partial<{ colorTheme: ColorTheme }>) => void,
) {
    if (isLightTheme(currentTheme)) {
        // Switching to dark — restore the last used dark variant
        const stored = localStorage.getItem(LAST_DARK_THEME_KEY) as ColorTheme | null;
        const target = (stored && DARK_THEMES.includes(stored)) ? normalizeDarkTheme(stored) : 'dark';
        withViewTransition(() => updatePreferences({ colorTheme: target }));
    } else {
        // Switching to light — remember current dark variant first
        localStorage.setItem(LAST_DARK_THEME_KEY, normalizeDarkTheme(currentTheme));
        withViewTransition(() => updatePreferences({ colorTheme: 'light' }));
    }
}

/**
 * Shared motion choreography, built on anime.js v4.
 *
 * Division of labour in this app:
 *   CSS          — state changes (hover, focus, active, checked). Cheap,
 *                  interruptible, and they survive React re-renders.
 *   anime.js     — choreography: ordered multi-element reveals, value
 *                  tweening (counters), and anything driven by data.
 *   motion/react — layout and presence (AnimatePresence, shared layout),
 *                  which is genuinely hard to do imperatively.
 *
 * Nothing here animates `width`, `height`, `top` or `left`. Only `opacity` and
 * `transform` — those are the two properties the compositor can animate
 * without re-running layout, and a timetable grid with 100+ cells will drop
 * frames on anything else.
 *
 * Every helper returns a cleanup function, so callers can wire them straight
 * into a `useEffect` return without tracking animation instances.
 */

import { animate, stagger, utils } from 'animejs';
import { DUR, EASE, STAGGER, prefersReducedMotion } from './tokens';

export { DUR, EASE, STAGGER, prefersReducedMotion } from './tokens';

type Target = string | Element | Element[] | NodeListOf<Element> | null;

const noop = () => { };

function resolve(target: Target): Element[] {
    if (!target) return [];
    if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
    if (target instanceof Element) return [target];
    return Array.from(target as ArrayLike<Element>);
}

/**
 * Put targets in their finished state immediately.
 *
 * Used as the reduced-motion path. It deliberately clears the inline styles the
 * animation would have set rather than setting `opacity: 1`, so the element
 * falls back to whatever the stylesheet says — no orphaned inline values to
 * fight with later.
 */
function settle(els: Element[]): void {
    utils.remove(els);
    for (const el of els) {
        (el as HTMLElement).style.removeProperty('opacity');
        (el as HTMLElement).style.removeProperty('transform');
    }
}

/**
 * Reveal a grid of cells.
 *
 * The stagger is 2-D and radiates from the top-left, so the timetable fills in
 * the direction it is read (earliest day, earliest slot first) instead of
 * cascading uniformly left-to-right. `grid` must be [columns, rows].
 *
 * Cells rise 6px — small enough that it reads as the grid settling rather than
 * as cards flying in, which is the tell of a template.
 */
export function revealGrid(
    target: Target,
    opts: { grid?: [number, number]; delay?: number } = {},
): () => void {
    const els = resolve(target);
    if (!els.length) return noop;
    if (prefersReducedMotion()) { settle(els); return noop; }

    const a = animate(els, {
        opacity: [0, 1],
        translateY: [6, 0],
        duration: DUR.slow,
        ease: EASE.out,
        delay: opts.grid
            ? stagger(STAGGER.tight, { grid: opts.grid, from: 'first', start: opts.delay ?? 0 })
            : stagger(STAGGER.tight, { start: opts.delay ?? 0 }),
    });

    return () => { a.pause(); settle(els); };
}

/**
 * Reveal a list or toolbar: a slightly slower stagger, sliding in from the
 * inline start rather than from below, so it doesn't read as the same gesture
 * as the grid.
 */
export function revealList(target: Target, opts: { delay?: number } = {}): () => void {
    const els = resolve(target);
    if (!els.length) return noop;
    if (prefersReducedMotion()) { settle(els); return noop; }

    const a = animate(els, {
        opacity: [0, 1],
        translateX: [-8, 0],
        duration: DUR.base,
        ease: EASE.out,
        delay: stagger(STAGGER.base, { start: opts.delay ?? 0 }),
    });

    return () => { a.pause(); settle(els); };
}

/**
 * Enter transition for overlays (dropdowns, popovers, modals).
 *
 * Scales from 0.98, not from 0.9: at 2px corner radius there is no rounding to
 * disguise the resample, so a large scale delta looks blurry mid-flight.
 * `transformOrigin` lets a dropdown grow out of the control that opened it.
 */
export function enterOverlay(
    target: Target,
    opts: { origin?: string; duration?: number } = {},
): () => void {
    const els = resolve(target);
    if (!els.length) return noop;
    if (prefersReducedMotion()) { settle(els); return noop; }

    if (opts.origin) {
        for (const el of els) (el as HTMLElement).style.transformOrigin = opts.origin;
    }

    const a = animate(els, {
        opacity: [0, 1],
        scale: [0.98, 1],
        translateY: [-4, 0],
        duration: opts.duration ?? DUR.base,
        ease: EASE.out,
    });

    return () => { a.pause(); settle(els); };
}

/**
 * Count a number up to its final value.
 *
 * Used for the header counts. This is the one thing anime.js does here that
 * CSS cannot do at all — tween a plain JS value and write it into text — and
 * it is why the library earns its place alongside motion/react.
 *
 * Skipped entirely for small deltas: animating 2 → 3 is noise.
 */
export function countTo(
    el: HTMLElement | null,
    to: number,
    opts: { from?: number; duration?: number } = {},
): () => void {
    if (!el) return noop;

    const from = opts.from ?? Number(el.textContent?.replace(/\D/g, '') || 0);
    if (prefersReducedMotion() || Math.abs(to - from) < 3) {
        el.textContent = String(to);
        return noop;
    }

    const state = { v: from };
    const a = animate(state, {
        v: to,
        duration: opts.duration ?? DUR.slow,
        ease: EASE.out,
        onUpdate: () => { el.textContent = String(Math.round(state.v)); },
        onComplete: () => { el.textContent = String(to); },
    });

    return () => { a.pause(); el.textContent = String(to); };
}

/**
 * Draw attention to an element that changed underneath the user — a slot that
 * just got filled, a card that moved. A brief accent ring, no movement, so it
 * never fights with whatever the user is currently doing.
 */
export function flagChange(target: Target): () => void {
    const els = resolve(target);
    if (!els.length || prefersReducedMotion()) return noop;

    const a = animate(els, {
        boxShadow: [
            'inset 0 0 0 1px rgba(63,187,125,0)',
            'inset 0 0 0 1px rgba(63,187,125,0.9)',
            'inset 0 0 0 1px rgba(63,187,125,0)',
        ],
        duration: 900,
        ease: EASE.inOut,
    });

    return () => {
        a.pause();
        for (const el of els) (el as HTMLElement).style.removeProperty('box-shadow');
    };
}

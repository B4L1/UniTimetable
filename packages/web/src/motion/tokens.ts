/**
 * Motion tokens — the JS half of the design system.
 *
 * These mirror the `--dur-*` / `--ease*` custom properties in index.css.
 * CSS owns state changes that a stylesheet can express (hover, focus, active);
 * anime.js owns choreography — anything where several elements need to move in
 * a deliberate order, or where the timing has to be driven by data.
 *
 * Change a value here and you must change its twin in index.css. That
 * duplication is the price of not parsing computed styles on every animation.
 */

export const DUR = {
    /** State flips a pointer can outrun. Hover, focus rings, chips. */
    fast: 120,
    /** The default. Panel reveals, tab switches, single-element moves. */
    base: 180,
    /** Anything travelling across the viewport, or a full-grid reveal. */
    slow: 280,
    /** Modals and page-level transitions. Long enough to read as spatial. */
    page: 320,
} as const;

/**
 * anime.js v4 easing strings.
 *
 * `outQuint` is the workhorse: it covers ~80% of its distance in the first
 * third of the duration, so a reveal feels like it has already arrived by the
 * time you notice it — which is what makes a flat UI feel quick rather than
 * animated. Symmetric curves (inOut*) are reserved for things that genuinely
 * travel both ways, like a drawer.
 */
export const EASE = {
    out: 'outQuint',
    inOut: 'inOutQuart',
    /** Springs only for spatial moves the user initiated (dragging, opening). */
    spring: 'outBack(1.4)',
} as const;

/** Per-item offset for staggered reveals, in ms. */
export const STAGGER = {
    /** Dense grids — 100+ cells. Any slower and the last cell lands late. */
    tight: 12,
    /** Lists and toolbars. */
    base: 26,
} as const;

/**
 * Honour the OS "reduce motion" setting.
 *
 * Read at call time, not at module load: users change this setting mid-session
 * (and browser devtools emulate it), and a cached value would silently ignore
 * them. Every helper in ./index.ts checks this and degrades to a plain state
 * change rather than skipping the animation's end state — an element that is
 * mid-fade when motion is disabled must still end up visible.
 */
export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

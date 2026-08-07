# `_archive/` — retired code, kept on purpose

Nothing in this folder is imported by the app. It is excluded from
`tsconfig.json` and never enters the bundle, so it costs nothing to keep.

It exists so that a design decision can be reversed without archaeology
through `git log`.

## `backgrounds/` — the WebGL background effects (retired 2026-07-28)

Aurora, Beams, Dither, Silk, FaultyTerminal, Iridescence, LiquidChrome and
PixelBlast, plus their CSS.

**Why they were retired.** Two reasons, and the first is the real one:

1. They fought the new flat design language. A hairline-and-flat-surface
   system relies on the background being genuinely inert — every border in the
   UI is 1px, and a shifting gradient behind it destroys the crispness that
   makes the whole thing read as deliberate. The frosted surfaces used to
   mediate between the animated background and the content; with those gone,
   the effects sat directly behind hard-edged panels and looked like two
   different apps overlaid.
2. Cost. Together they pulled in `three`, `@react-three/fiber`,
   `@react-three/drei`, `@react-three/postprocessing`, `postprocessing` and
   `ogl` — several megabytes of dependency for decoration that was off by
   default and carried a performance warning before you could enable it.

They were replaced by CSS-only ambient backgrounds (`components/backgrounds/
BackgroundSelector.tsx`), which cost nothing and hold still.

## Restoring one

1. Move the component and its CSS back into `src/components/backgrounds/`.
2. Re-add the dependencies it needs to `packages/web/package.json`:
   - Aurora, Silk, Beams → `ogl`
   - Dither, PixelBlast → `three`, `@react-three/fiber`, `@react-three/postprocessing`, `postprocessing`
   - FaultyTerminal, Iridescence, LiquidChrome → `ogl`
3. Re-add its id to `BackgroundEffect` in `packages/shared/lib/types.ts`, to
   `VALID` in `src/utils/backgroundEffect.ts`, and to `EFFECT_COMPONENTS` +
   `BACKGROUND_EFFECTS` in the selector and `Settings.tsx`.
4. Import it lazily (`React.lazy`) — the default bundle must stay free of
   `three`/`ogl`.

Stored preferences naming a retired effect fall back to `none` rather than
erroring, so no migration is needed in either direction.

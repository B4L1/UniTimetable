// Ambient background renderer.
//
// The WebGL effects that used to live here (Aurora, PixelBlast, Iridescence,
// LiquidChrome, FaultyTerminal) are retired — see src/_archive/README.md for
// the reasoning and for how to bring one back.
//
// What replaced them are two CSS-only ambients drawn from the same technical-
// drawing vocabulary as the rest of the UI. Both are static: in a flat system
// the background's job is to give the hairlines something to sit on, not to
// compete with them. They also cost nothing — no canvas, no RAF loop, no
// dependency, and no performance warning before the user is allowed to switch
// one on.
//
// Both take their colour from `--grid-line`, so each one suits whichever theme
// is active instead of needing separate light and dark variants.

import { memo } from 'react';
import { useBackgroundEffect, prefersReducedMotion } from '../../utils/backgroundEffect';
import './backgrounds.css';

function BackgroundSelector() {
    const effect = useBackgroundEffect();

    // Nothing here animates, so reduced-motion could safely render these. It
    // still doesn't: someone asking for less visual noise gets a plain surface.
    if (effect === 'none' || prefersReducedMotion()) return null;

    return <div className={`app-ambient app-ambient--${effect}`} aria-hidden="true" />;
}

export default memo(BackgroundSelector);

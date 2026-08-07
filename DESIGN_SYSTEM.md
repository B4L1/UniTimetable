# UniTimetable — "Blueprint" design system (v4)

*Replaces the glass/rounded look. July 28, 2026.*

The one-paragraph version: **structure is drawn with 1px hairlines, never with
blur or shadow.** Corners are 2px. Surfaces are opaque and step in value.
Colour is rationed — the chrome is neutral, and saturation is spent almost
entirely on the subject accent bars, so the timetable is the only colourful
thing on screen. Metadata is mono, prose is Inter.

---

## 1. Why this and not the old one

The previous system had two structural problems, and everything else followed
from them.

**Depth was doing a job borders should do.** Frosted panels, 12–16px radii and
layered shadows meant every surface needed three properties to separate itself
from its neighbour, and those properties disagreed across themes — the light
theme overrode blur to `none` and the terminal theme forced `border-radius: 0`,
so there were effectively three different looks maintained in parallel. With
hairlines, one border token defines separation everywhere and the themes are
pure colour swaps again.

**Subject colour was the card background.** That single decision cascaded: the
palette had to stay muted so text stayed readable, which made 16 subjects hard
to tell apart; the light theme had to force `color: #fff !important` on card
text, which failed on the paler entries; and week-parity had to be encoded as a
diagonal gradient behind the card because the front was already spoken for.
Moving colour to a 3px bar unpicks all of it at once.

---

## 2. Tokens

All in `packages/web/src/index.css` (dark, the base) and
`src/themes/sapientia.css` (light). Components read **only** semantic tokens.

### Surfaces — opaque, stepped by value

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg-app` | `#08090a` | `#eceef1` | Page canvas |
| `--bg-surface` | `#0c0e10` | `#ffffff` | Panels, header, dock |
| `--bg-elevated` | `#131619` | `#ffffff` | Cards, overlays, modals |
| `--bg-inset` | `#050506` | `#e4e7ea` | Wells: inputs, gutters, tag groups |

The dark ramp is deliberately **not** Tailwind slate (`#0f172a` and friends).
That specific navy-tinted ramp is the single most recognisable "generated
dashboard" tell, and it was the strongest reason the old UI read as templated.

Note the light theme inverts the relationship: the page is the mid-tone and
cards sit *above* it in white. That's what gives the light theme structure
without any blur.

### Hairlines — opaque, not alpha

`--border-subtle` → `--border-default` → `--border-strong`, plus `--grid-line`.

They're opaque hex rather than `rgba(255,255,255,0.08)` on purpose: an alpha
border computes differently against every surface it crosses, so a card border
and a panel border that are nominally the same never quite line up. At 1px that
misalignment is visible.

### Radius — one value

`--radius-xs/sm/md/lg` all resolve to **2px**. The four names survive so that
existing component CSS keeps resolving; they all land on the same corner.
`--radius-pill` stays round for the few genuinely circular things.

### Elevation

`--shadow-sm` and `--shadow-md` are `none`. Content surfaces get no shadow —
borders do that job. Shadows exist only for things that genuinely float:
modals, the planner dropdown, dock tooltips, toasts.

### Accent

`--accent` is Sapientia green, lifted to `#3fbb7d` for dark backgrounds and
`#0A6C42` in light. It replaced indigo `#6366f1`, which was both the generic
default and inconsistent with the light theme's brand green.

### Motion

`--dur-fast: 120ms` / `--dur-base: 180ms` / `--dur-slow: 280ms`, with
`--ease: cubic-bezier(0.2, 0, 0, 1)`. Flat UI has no depth to hide sloppy
timing behind, so durations are short and the curve is decisive. These are
mirrored in `src/motion/tokens.ts` — **change both together.**

---

## 3. The card system

`ClassCard.css`. Neutral fill, subject colour in a 3px bar across the top.

Two consequences worth stating explicitly:

- **Contrast is now fixed by the theme, not by the palette.** Adding a 17th
  subject colour can't break legibility, because no text ever sits on a subject
  colour.
- **A bar is easier to scan than a fill.** Down a column, the eye compares each
  bar against the same neutral rather than comparing tints against each other.

### Week parity lives in the bar

The fortnight is drawn as two halves and the inactive half is knocked back —
odd weeks fill the left half, even weeks the right. The knock-back is the card
background painted over at partial opacity rather than a lighter colour, which
keeps it correct in every theme for free. The same left/right-half language is
reused by the week indicator chip in the header, so it's learned once.

### User-edited entries

A **dashed hairline** on the card border. Dashed is the app's consistent signal
for "optional / provisional / editable" — it's also the import button and the
empty planner slot.

### The palette

`packages/shared/lib/colors.ts`. 24 colours generated in OKLCH at fixed
`L = 0.635` and near-maximum in-gamut chroma, sampled every 15° of hue.

Fixed lightness matters: it means no subject's bar looks louder or more urgent
than another's, which is exactly the failure mode of a hand-picked palette.
Every entry clears 4.9:1 against the dark card and 3.2:1 against the light one.

The list order is **not** hue order. `assignColor()` probes forward from a hash
index, so consecutive palette entries routinely land on different subjects in
the same timetable; the array is strided by 11 (coprime with 24) so each entry
sits ~165° of hue away from its neighbours.

---

## 4. State lives on an edge

One idea, applied everywhere, so selection is legible without spending colour:

| Element | Marker |
|---|---|
| Class card | 3px subject bar, top |
| Dock tab (active) | 2px accent rail, bottom |
| Mobile menu item (active) | 2px accent rail, leading edge |
| Settings dropdown (selected) | 2px accent rail, leading edge |
| Day header (today) | 2px accent rail, top |
| Toast (success/error) | 2px status rail, leading edge |

Filled-accent blocks were removed from all of these. A filled "today" column
shouted across an otherwise quiet grid; a rail is just as findable.

---

## 5. Motion

`src/motion/` — anime.js v4, alongside `motion/react`. Division of labour:

- **CSS** — state changes a stylesheet can express (hover, focus, active).
  Cheap, interruptible, survives re-renders.
- **anime.js** — choreography: ordered multi-element reveals, and value
  tweening. `countTo()` is the case neither of the others can do at all: tween
  a plain JS number and write it into a text node.
- **motion/react** — layout and presence (`AnimatePresence`, shared `layoutId`),
  which is genuinely hard to do imperatively.

Nothing animates `width`, `height`, `top` or `left` — only `opacity` and
`transform`. A grid with 100+ cells drops frames on anything else.

The timetable's reveal is a 2-D stagger radiating from the top-left, so the
grid fills in reading order (earliest day, earliest slot first). It's keyed on
the entry-id set, not on mount, so resizes and parity flips don't replay it.

Every helper checks `prefers-reduced-motion` at call time and degrades to the
finished state — never to a skipped one.

---

## 6. What was removed

| Thing | Why |
|---|---|
| Frosted glass (`backdrop-filter`) | Zero instances remain. It was mediating between animated backgrounds and content; with those gone it only softened edges the system relies on. |
| `dark-glass` theme | Was the frosted variant. `migrateColorTheme()` folds stored values into `dark`. |
| WebGL backgrounds | Moved to `src/_archive/backgrounds/` (not deleted — see its README). Dropped `three`, `@react-three/*`, `postprocessing`, `ogl`. Replaced by CSS grid/dot/scanline textures. |
| `GlareHover` | Moved to `src/_archive/`. The white sweep was a glass-era flourish. |
| Indigo→violet gradients | Wordmark, start button, empty-slot glyphs. Zero instances remain. |
| The navy dock slab (light theme) | The dock is now the same flat panel as everything else. |
| The mint tint on settings/welcome cards | The only surface in the app carrying hue for no informational reason. |
| `transition: all` | Replaced with explicit property lists — `all` can animate layout properties by accident. |
| The perf warning before enabling a background | There's nothing left to be slow. |

---

## 7. Rules for new work

1. Reach for a **border** before a shadow, and a **value step** before a border.
2. Radius is `var(--radius-sm)`. If you're typing a number, stop.
3. Colour means something. Neutral is the default; accent marks state; subject
   colour belongs to a class and appears only on its bar.
4. Times, rooms, codes and counts are `--font-mono` with tabular figures.
   Prose is `--font-sans`.
5. Transitions name their properties and use `--dur-*` / `--ease`.
6. New surface? Check whether `.panel`, `.well` or `.overlay` already covers it.
7. No inline styles for anything static. The one legitimate exception is a value
   computed at runtime (a grid span, a stacking offset).

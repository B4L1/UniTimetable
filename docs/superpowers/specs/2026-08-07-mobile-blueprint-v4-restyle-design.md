# Mobile app: Blueprint v4 restyle (Phase 1 of mobile parity)

*2026-08-07*

## Context

`packages/mobile` (Expo Router, RN 0.81) is a working, non-trivial app: day-pager
timetable with week parity, a basic planner, settings, onboarding, and a
genuinely well-built Android widget (`packages/mobile/widget/`) that shows the
current-or-next class with `‹`/`›` arrow navigation (Android widgets can't do
swipe/scroll between cards, so arrows are the correct answer — confirmed to
keep as-is).

Its visual design predates the web app's "Blueprint v4" redesign
(`DESIGN_SYSTEM.md`, commit `ab2e46e`): mobile still uses the retired
glass/rounded look (indigo `#6366f1`, alpha borders, 12–16px radii), while web
moved to opaque hairline borders, 2px radii, and a Sapientia-green accent.
Mobile is also missing some newer web features (PlannerWizard, ClassDetailModal,
subject import, toast system) — **out of scope for this pass**, tracked as
Phase 2.

This spec covers **Phase 1 only: visual restyle to Blueprint v4**, plus repo
cleanup and iOS build plumbing, decided with the user:

- Renovate `packages/mobile` in place (data layer, store, widget logic are solid
  — do not rebuild).
- Restyle first, port missing features later (separate future spec/plan).
- iOS: no local Mac — set up EAS cloud build config; do not attempt to actually
  build/test iOS device binaries in this session.
- Delete dead code: `packages/widget-app` (superseded experiment) and the
  root-level orphaned Expo app (`app/`, `components/`, `i18n/`, `global.css`,
  `tailwind.config.js` — not wired into the pnpm workspace, doesn't build).
- Widget keeps its arrow-nav pattern; just gets restyled.

## Scope

### 1. Repo cleanup
- Delete `packages/widget-app/` entirely.
- Delete root `app/`, `components/`, `i18n/`, `global.css`, `tailwind.config.js`
  (confirmed not referenced by `pnpm-workspace.yaml`, which only globs
  `packages/*`).
- Remove `dev:mobile`-adjacent leftover scripts/refs to widget-app if any exist
  in root `package.json`.

### 2. Design tokens
Replace `packages/mobile/constants/theme.ts` with values read directly from
`packages/web/src/index.css` (dark theme — mobile has no light theme today, out
of scope to add one):

| Token | Value |
|---|---|
| `bg-app` | `#08090a` |
| `bg-surface` | `#0c0e10` |
| `bg-elevated` | `#131619` |
| `bg-inset` | `#050506` |
| `border-subtle` | `#1c1f23` |
| `border-default` | `#26292e` |
| `border-strong` | `#383c43` |
| `grid-line` | `#16181b` |
| `accent` | `#3fbb7d` |
| `accent-hover` | `#5ed296` |
| `accent-subtle` | `rgba(63,187,125,0.12)` |
| `accent-line` | `rgba(63,187,125,0.4)` |
| radius | `2px` everywhere (keep `xs/sm/md/lg` names resolving to 2, per web) |
| shadow | none, except modals (none exist on mobile yet — n/a this phase) |

Fonts: add `Outfit` (sans, prose) and `JetBrains Mono` (mono, times/rooms/codes)
via `@expo-google-fonts/outfit` + `@expo-google-fonts/jetbrains-mono` +
`expo-font`, loaded in `app/_layout.tsx` with a splash-hold until loaded
(`expo-splash-screen`). Subject palette: already correctly shared via
`packages/shared/lib/colors.ts` — no change needed, just needs to render as a
top bar instead of full-tint fill on cards (see below).

Delete `packages/mobile/constants/Colors.ts` (dead default-template leftover,
superseded by `theme.ts`) and fix its one remaining import in
`app/onboarding.tsx`.

### 3. Screen-by-screen restyle
Apply the new tokens/fonts, replacing every hardcoded hex currently in these
files with the token equivalents:
- `app/_layout.tsx`, `app/(tabs)/_layout.tsx` — tab bar chrome, splash bg
- `app/(tabs)/timetable.tsx` — card fill → neutral `bg-elevated` + 3px subject
  bar on top (matches web's `ClassCard.css` change — color moves off the fill),
  week-parity shown as left/right half-knockback on the bar, hairline borders,
  mono font for times/rooms
- `app/(tabs)/planner.tsx` — same card treatment, hardcoded `#818cf8`/`#12121a`/
  `#1a1a24`/`#6366f1` etc. replaced with tokens
- `app/(tabs)/settings.tsx` — same token sweep
- `app/onboarding.tsx` — drop the indigo/purple/pink `LinearGradient` cards
  (retired on web per `DESIGN_SYSTEM.md` "what was removed"); flat
  `bg-elevated` panels with hairline borders instead
- `hooks/useTheme.ts` — confirm it just re-exports `theme.ts`, update if it
  hardcodes anything

State-as-edge-rail convention (`DESIGN_SYSTEM.md` §4) applies wherever mobile
has an equivalent: active tab → 2px accent rail; selected settings row → 2px
leading-edge accent rail.

### 4. Widget restyle
`widget/WidgetUI.tsx`: same token swap — opaque hairline border, 2px radius,
subject color as a top bar rather than tinted background, `● MOST` in accent
green. Android `RemoteViews` widgets cannot load arbitrary custom fonts easily
(no `Typeface` asset loading through `react-native-android-widget`'s JSX-to-
RemoteViews renderer) — **keep system default font in the widget**, matching
by color/spacing/border only. This is a deliberate scoped exception, noted so
it's not mistaken for an oversight later.

### 5. iOS / EAS setup
- Add `packages/mobile/eas.json` with `development`/`preview`/`production`
  build profiles (standard Expo template shape).
- No Apple Developer account action is taken in this session — bundle
  identifier (`com.unitimetable.mobile`) is already set in `app.json` and
  stays as-is. Actually running `eas build -p ios` requires the user to be
  logged into an Expo account interactively; that step is called out in the
  final report, not performed here.

## Out of scope (Phase 2, future spec)
PlannerWizard, ClassDetailModal, ImportSubjectModal, toast/confirm system,
sharing, ICS export UI on mobile. Tracked but not designed here.

## Verification
- `pnpm --filter @unitimetable/mobile typecheck` must pass after every screen
  is touched.
- No device/emulator is available in this environment — visual correctness
  will be verified by the user after this session; report will say so
  explicitly rather than claiming a look-tested result.

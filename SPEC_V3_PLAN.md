# UniTimetable — Spec v3 Implementation Plan
*Created 2026-07-11. Source: user-provided "Timetable App – Full UI & System Specification (v3)".*
*This file is the working document for the redesign. Update the phase checklists as work lands.*

---

## Part A — The Spec (authoritative summary)

### A0. Objective
High-performance, visually clean, constraint-driven timetable that fits entirely on desktop (**zero vertical scrolling**), feels fluid, and generates schedules intelligently.

### A1. Design philosophy
- Clarity > decoration · Motion > visual effects · Consistency > creativity · Performance is a feature.
- **Anti-goals:** heavy animated backgrounds, excessive glassmorphism, visual clutter, hidden logic.

### A2. Layout (hard constraints)
- Page = flex column: `Navbar (fixed) → Toolbar → Timetable (flex:1, overflow:hidden)`.
- Fits `100vh`; **no vertical scroll, no nested scroll containers** (desktop).
- Time compression: 1h = 56px default, shrink to ~44px if needed.
- If still too small: reduce spacing scale + font sizes; never enable scroll; fallback message as last resort.

### A3. Spacing & sizing (strict)
- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32` — no arbitrary values.
- Radius: 6px small, 12px medium, 16–20px large.

### A4. Color
- Dark: bg `#020617`, surface `#0f172a`, border `rgba(255,255,255,0.08)`.
- Light (Sapientia-aligned): bg `#f1f5f9`, surface `#ffffff`, border `rgba(0,0,0,0.06)`.
- Course colors: muted tones, consistent brightness, no neon.

### A5. Surfaces
- Cards: solid background + subtle border + soft shadow.
- Glassmorphism allowed **only** on navbar (optional) and modals. Forbidden on content cards and timetable elements.

### A6. Typography
- Inter (or similar). Title semibold, body regular, meta smaller + lower opacity.

### A7. Timetable grid
- Fixed left time column, top day headers, equal day columns.
- Grid lines `rgba(255,255,255,0.05)` (very subtle).
- Event cards: course name (primary), type lab/lecture, time/room (secondary); medium radius, soft shadow, 8–12px padding.
- Overflow: ellipsis + tooltip on hover.

### A8. Motion
- Framer Motion springs.
- Drag & drop: scale up, stronger shadow, smooth snap.
- State changes: fade/slide. Hover 1.02, press 0.98.

### A9. Planner flow (stepper)
`Profile → Courses → Preferences → Generate → Edit`
- **Courses:** toggle on/off, add external courses, mark optional/required.
- **Preferences:** allowed days (hard), time range, sliders for gaps / early classes / compactness.
- **Generate:** 3–5 schedules, each with an explanation.
- **Edit:** manual edits, lock events, exclude events, "improve schedule".

### A10. Data model (target)
- `courses` (id, name, is_optional)
- `events` (id, course_id, group_id, day, start_time, end_time)
- `user_course_selection` (user_id, course_id, included, is_required)
- `user_constraints` (allowed_days, earliest_start, latest_end, weights)
- `user_event_preferences` (locked_events, excluded_events)

### A11. Constraints
- **Hard:** no overlaps, allowed days, time window, required courses included.
- **Soft:** minimize gaps, avoid early classes, reduce days used.

### A12. Generator
- Pipeline: `build set → filter → generate → score → return best`.
- `score = gap_hours*W1 + early_classes*W2 + days_used*W3`.
- Output top 3–5 with per-schedule explanation.

### A13. Smart editing
- Lock (prevents changes), exclude (prevents reintroduction), improve (re-run with constraints).

### A14. Sync
- Scraper diff detection; store `last_updated` + `source_hash`. UI shows update time and highlights changes.

### A15. Errors
- Always explain constraints ("This course only exists on Friday.") with options: allow exception / remove course.

### A16. Performance
- 60fps interactions, instant feedback. No heavy backgrounds, no blocking operations.

### A17. Definition of done
No-scroll desktop timetable · clean consistent UI · working constraint generator · smooth interactions · clear feedback/explanations.

---

## Part B — Additions & Corrections (things the spec misses)

These are domain facts from the existing app/data that the spec must absorb, or the build will be wrong.

### B1. Week parity is a first-class dimension ⚠️ CRITICAL
Every event has `week_type: all | odd | even` (currently 850/255/171 of 1,276 entries).
- **Overlap detection must be parity-aware:** an `odd` and an `even` event at the same time do NOT conflict; `all` conflicts with both.
- The generator's hard "no overlaps" constraint, gap scoring, and the grid rendering (split cells) all depend on this.
- Academic-week calculation lives in `packages/web/src/utils/calendar.ts` (hardcoded 2025/26 dates — move to a `semesters` config, already a known TODO).

### B2. Migration path from the live schema
Current tables: `classes` (73, = cohort like "Informatika III.B."), `timetable_entries` (1,276), `teachers`, `user_selections`, `user_preferences`. Real users exist — don't break them.
- Mapping: spec `courses` ≈ distinct `subject_name` (needs a normalization pass — "e.a." / "gyak." / "szem." suffixes distinguish lecture/lab/seminar of the *same* course, and encode the spec's "type" field); spec `events` ≈ `timetable_entries`; spec `group_id` ≈ `class_id` (the cohort).
- Strategy: **additive migration** — new tables/views alongside the old ones, switch reads over, then retire. Never a destructive rewrite of `timetable_entries`.
- `events` needs `week_type` and `room`, `teacher` columns — the spec's event model omits all three; the cards and detail views need them (data verified clean on 2026-07-10, see `supabase/cleanup_2026-07-10.sql`).

### B3. Mobile is out of scope for the no-scroll rule
The existing mobile day-carousel (swipe between days, `max-width: 768px` branch in `Timetable.tsx`) works well and stays. The `100vh`/no-scroll constraint applies to **desktop only**. Stepper must also be usable on mobile (vertical steps or swipe).

### B4. Features to preserve (regression list)
- Google auth + preference sync (Supabase)
- Image export (`export.tsx` pipeline) — must be re-pointed at the new grid
- Shared groups / "közös óra" indicators in Planner
- Subject import + cross-major search (these become the "add external courses" step — the logic already exists in `shared/lib/api.ts`)
- Per-subject deterministic colors (`shared/lib/colors.ts`) — keep the hash mechanism, **swap the palette to muted tones** per §A4.3 (current palette is explicitly neon — direct conflict)
- Hungarian UI text (EN i18n is a separate future task)

### B5. Backgrounds & glass — DECIDED 2026-07-11
- **Base themes are simple and clean, always:** Sapientia light (default) + basic dark. No effects, no glass on content.
- **Animated backgrounds survive as opt-in extras**, not defaults: lazy-loaded chunks, never in the initial bundle, with a warning on enable ("Ez lassíthatja az alkalmazást ezen az eszközön" / may slow down your device). Auto-off under `prefers-reduced-motion`.
- **Easter egg stays**, off by default, can be turned off after unlocking.
- **Seasonal looks (Christmas, Easter, …) must be cheap to add** → themes are pure token overrides (colors, accents, maybe a flat decorative asset), never new component styles or scripts.
- **Frosted glass:** never on the light theme. Offered as an optional **"Dark Glass"** theme variant (dark tokens + translucent surfaces) for people who like the current look.
- Full architecture in B9/B10 below.

### B6. Generator: run client-side, brute force is fine
The spec says "backend architecture" but no server is needed: a cohort + imported subjects is ~20–40 events with few alternatives per course. Enumerate group combinations per course with pruning (typically ≪ 10k combos), score synchronously; move to a Web Worker only if profiling demands it. Pure TypeScript in `@unitimetable/shared` → unit-testable (the first real tests in the repo — vitest).
- Scoring needs one more term than the spec: **parity-aware gap hours** (a gap that exists only on odd weeks costs half).
- Default weights to start: gaps 1.0/h, early class (before 10:00) 1.5 each, day used 2.0. Tune later; expose as the three sliders.

### B7a. Split-slot disambiguation via teacher timetables (user's plan, 2026-07-12)
When a student group's slot contains two classes, there are two very different cases the scraper must tell apart:
1. **Alternating weeks** (odd/even) — e.g. Informatika III.B Wed 14:30: "Információ keresés gyak." ↔ "Osztott rendszerek gyak." Both currently misscraped as `all`.
2. **Parallel optionals** — two elective classes genuinely running every week; students attend one.

**Disambiguation mechanism (user-corrected 2026-07-12 — this is the authoritative version).**
The signal is not inference — edupage *renders* the answer in the teacher's timetable view:
- a **biweekly (alternating) class occupies only half the cell height** (horizontal split) in the teacher's own timetable;
- a **weekly class fills the full cell**.

So the pipeline is:
1. **Find candidates** with a DB query (no re-scraping): every student-group slot holding 2+ events marked `all` → `v_split_slot_review` view from migration 002.
2. **Resolve each entry exactly** by fetching that entry's teacher's timetable from edupage (one targeted request per teacher, not a full re-scrape) and checking the cell rendering at that slot: half-height → the class alternates (`odd`/`even` — which one comes from the edupage week attribute/position of that half-cell); full-height → genuinely weekly → the student-side collision is **parallel optionals**, keep `all`.
3. Two different teachers on the colliding entries is the normal case — each teacher's view resolves their own entry independently.
4. Teacher missing from an entry / rendering unclear → mark `ambiguous` for manual review; never silently default.

Until this lands (Phase 6), users correct individual entries via the Planner's week-type override, which now applies everywhere. The Phase 2 schema makes the classification explicit (`week_type_source` on events: scraped / derived-teacher / manual / ambiguous) so ambiguity is visible instead of baked in as wrong data.

### B7. Sync/scraper additions
- Add `source_hash` + `last_updated` to `timetable_entries` (spec §14) — enables diff-based re-scrape instead of the current wipe-and-reload, which is what caused the stale-class duplicates cleaned up on 2026-07-10.
- **Scraper bug guard:** when the room is a named lab (Periferice/SCADA/SOFTWARE/Real/Interfete), the scraper swapped teacher↔room (17 rows patched by hand). Add a validation step: if `classroom` matches a person-name pattern (incl. Hungarian digraph initials `Sz. Gy. Cs. Zs.` and double initials), swap or flag.
- "Highlight changes" in UI = per-entry `updated_at` newer than user's last visit.

### B8. Toolchain gaps
- No tests, no CI → add vitest + a GitHub Action (typecheck + lint + test) in Phase 0 so the generator lands tested.
- Design tokens: `index.css` already has `--radius-*`, `--transition` tokens from the last audit; extend with the strict spacing scale (`--space-1..6`) and the new color values, then sweep out remaining arbitrary values.
- `react-select` styling fights the token system; likely replace with a small custom listbox during the stepper build.

### B9. Theme architecture (two independent layers)

The current model (theme = colors + background + component styles tangled together) is replaced by:

**Layer 1 — Color theme (semantic tokens only).** Components never reference raw colors; they consume semantic tokens. A theme is nothing but a token map:

```
light      (Sapientia, default)
dark       (basic)
dark-glass (dark tokens + translucent surface tokens + backdrop-blur — the "extra" theme)
terminal   (easter egg, unlockable, off-able)
christmas / easter / …   (future seasonal: token overrides + optional flat decoration)
```

Adding a seasonal theme = one CSS file of token overrides, zero JS, zero perf cost.

**Layer 2 — Background effect (independent of theme).** Default `none`. The animated backgrounds (Aurora, Silk, Beams, …) live here as **lazy-loaded chunks**:
- not imported in the default bundle at all (`import()` on selection only)
- enabling one shows a one-time perf warning
- forced off by `prefers-reduced-motion`
- selection persists per device (not synced — a laptop choice shouldn't slow a phone)

**Token vocabulary (Linear/Stripe-style semantic naming):**

```
--bg-app          page background
--bg-surface      cards, panels
--bg-elevated     modals, popovers, dropdowns
--bg-hover        row/item hover
--border-subtle   default hairlines, grid lines
--border-strong   inputs, focused/active edges
--text-primary    headings, event names
--text-secondary  body, labels
--text-tertiary   meta (time/room), placeholders
--accent          brand action color (Sapientia blue in light)
--accent-hover / --accent-subtle (tinted bg)
--danger / --warning / --success
--shadow-sm / --shadow-md / --shadow-lg
--radius-sm (6) / --radius-md (12) / --radius-lg (16)
--space-1..6 (4/8/12/16/24/32)
```

### B10. Design-system standards (the "Linear/Stripe bar")

What actually makes those sites feel clean — adopt as rules, not vibes:

1. **Hierarchy from restraint:** one accent color; everything else neutral. Color signals action or state, never decoration. Course colors on the grid are the only polychrome surface — muted, consistent-brightness palette.
2. **Borders before shadows:** hairline borders (`--border-subtle`) define structure; shadows only communicate elevation (dropdown, modal, dragged card). Max 3 shadow levels.
3. **Type scale, strict:** Inter at 12/13/14/16/20/24, weights 400/500/600 only. Times/numbers use `font-variant-numeric: tabular-nums` so grid times align.
4. **4px grid everywhere:** the B3 spacing scale is law; densities shift by stepping down the scale, never by ad-hoc values.
5. **Every interactive element has all 5 states:** default / hover / active / focus-visible (keyboard ring) / disabled. Defined once per component, in the component's CSS, from tokens.
6. **Motion is functional:** 120–200ms; springs only for spatial moves (drag, snap, reorder), ease curves for opacity/color. Nothing animates on page load. `prefers-reduced-motion` kills all non-essential motion globally.
7. **Contrast:** WCAG AA minimum (4.5:1 body text, 3:1 large/secondary) in both base themes — checked in Phase 0, not retrofitted.
8. **Component inventory** (one implementation each, no per-page variants): Button, IconButton, Select (custom, replaces react-select), Toggle, Slider, Checkbox, Card, Modal, Tooltip, Toast, Badge/Tag, Stepper, EventCard, EmptyState.

**Performance budget (product will serve much of the university):**
- Initial JS ≤ 200 KB gzipped (achievable once three.js leaves the default path — currently it ships eagerly)
- Route-level code splitting: Timetable is the critical path; Planner/Settings/Login lazy
- LCP < 1.5s on campus wifi, 60fps drag/scroll interactions, Lighthouse perf ≥ 95
- One Supabase round-trip to render the timetable (entries for the user's cohort, cached in localStorage for instant repeat loads)
- No blocking work on the main thread > 50ms (generator runs are small; move to Web Worker only if measured otherwise)

---

## Part C — Gap analysis (current → target)

| Area | Current | Target (spec) | Effort |
|---|---|---|---|
| Layout | Scrollable page, dock nav | 100vh flex, no scroll | M |
| Grid | CSS grid, slot-based, glass cards | Time-proportional, solid cards, subtle lines | M |
| Theming | Colors/backgrounds/styles tangled, bgs eager | Token themes (light/dark/dark-glass/terminal) + lazy opt-in effects | M |
| Planner | Single-page dropdown-per-slot editor | 5-step stepper + generator | L (biggest piece) |
| Generator | None (manual selection) | Constraint solver + scoring + explanations | L |
| Data model | classes/timetable_entries | courses/events/groups + constraint tables | M |
| Editing | Replace-via-dropdown | Drag & drop, lock, exclude, improve | L |
| Sync | Manual full re-scrape | Diff-based, hashes, UI freshness | M |
| Tests/CI | None | Generator unit tests + CI | S |

---

## Part D — Phased plan (work in this order)

Each phase ends in a working app. Don't start a phase until the previous one's checklist is green.

### Phase 0 — Foundation (tokens, hygiene, safety net) — DONE 2026-07-11
- [x] Add vitest + GitHub Action (`.github/workflows/ci.yml`: typecheck, lint, test, build); first 13 tests in `shared/lib/__tests__/`
- [x] Semantic token system (index.css `:root` = dark, `[data-theme='light']` in themes/sapientia.css, `dark-glass`, `terminal`); legacy `--bg-primary`-style names alias through semantics. Token values chosen to pass AA (light tertiary #64748b on white = 4.75:1; dark tertiary #76839a on #020617 ≈ 5:1)
- [x] Muted subject palette is now the single default in `shared/lib/colors.ts` (16 colors, saturation/luma band enforced by test); per-theme palette switching removed from App.tsx
- [x] Theme model split: `Preferences.colorTheme` (synced) + device-local background effect (`utils/backgroundEffect.ts`, localStorage, never synced). Old `backgroundTheme` migrated once on init (`migrateColorTheme` / `migrateBackgroundEffect` in shared types)
- [x] Effects lazy-only: BackgroundSelector preloading removed, `import()` on selection, perf warning (one-time confirm) on enable, `prefers-reduced-motion` disables entirely
- [x] Easter egg: unlock sets `colorTheme: 'terminal'`; both the theme and the faulty-terminal effect are switchable off in Settings; secret entries hidden until unlocked
- [x] Settings split into Téma (color theme) + Animált háttér (effect) dropdowns
- [x] Inter trimmed to 400/500/600 (+ `.tnum` tabular-nums utility); 700/800 usages reduced to 600
- [x] **Bonus:** export pipeline (`@react-pdf/renderer` + `pdfjs-dist`) made lazy — loads on first export click

**Baseline record (2026-07-11, after Phase 0):**
- Main bundle: 667 kB / **205 kB gzip** (was 2,329 kB / 741 kB gzip before the lazy-export change — the pre-Phase-0 default path also eagerly preloaded 5 effect chunks incl. 533 kB PixelBlast)
- CSS: 55 kB / 10.7 kB gzip. Export chunk (on demand): 1,655 kB. Effects (on demand): 2–534 kB each
- Remaining main-bundle weight to attack in Phase 7: react-dom, motion, supabase-js, react-select (dies in Phase 4), react-router
- LCP / Lighthouse: not yet measured — do on first deployed build

### Phase 1 — No-scroll shell + new grid (desktop) — DONE 2026-07-11
- [x] `100vh` shell: `.app-content--fixed` (overflow hidden) on the timetable route; verified 0 page scroll and 0 nested scroll containers in the browser
- [x] Grid fills remaining height via fractional rows (Sapientia classes are strictly 2h-slot aligned, so equal slot rows ARE time-proportional; per-minute positioning deferred until non-aligned data exists)
- [x] Grid restyle: one solid surface + `--grid-line` hairlines replaces the gap-separated glass tiles (`.tt-grid` in index.css); week chip in corner, subtle headers, accent "today"
- [x] Solid event cards (default variant; planner variants keep translucency their overlays need), 2-line clamp + ellipsis + native title tooltip; card content no longer a scroll container
- [x] Hover 1.02 / press 0.98 on timetable cards (CSS transitions, `prefers-reduced-motion` respected; springs arrive with drag & drop in Phase 5)
- [x] Image export needs no re-point — it renders from data via @react-pdf, not from the grid DOM; mobile carousel untouched and verified
- [x] Size tiers verified in browser: normal → `tt-compact` (<560px, smaller type) → `tt-too-small` (<340px, Hungarian fallback message), no scroll at any tier
- [x] Conditional Saturday column (2026-07-12): `day_of_week === 5` in the displayed data shows a 6th column (desktop) / 6th carousel day (mobile, lands on Saturday when today is one); hidden otherwise. DB currently has zero Saturday rows, so nothing changes until the scraper delivers some. Verified via fetch-interception in the browser (6 columns with fake Saturday entry, 5 without).
- [x] Height-adaptive cards (2026-07-12): each grid cell is a CSS size container; below 96px the teacher row hides, below 68px only the title shows, below 42px the title clamps to one line — no more overlapping text at small viewports
- [x] Class detail window (2026-07-12): tapping a card zooms it into a centered detail window (framer-motion shared `layoutId` morph on desktop, scale-in on mobile) showing teacher, full room string, day+time, week parity, group; closes via ✕, backdrop click, or Esc with the reverse zoom. Component: `components/ClassDetailModal/`
- [x] Dock tab-switch animation (2026-07-12): dock panel is a layout-animated motion element; tab-specific controls (planner search etc.) spring the bar wider/narrower (verified 308px→580px with intermediate frames), items pop in/out via AnimatePresence popLayout with stable ids
- [x] Timetable now applies Planner week-type overrides (2026-07-12): `customEntries` overrides feed the parity filter in Timetable.tsx (they previously only worked inside the Planner view — a pre-v3 gap, confirmed via git history). Background: the scraper marks some alternating group-split labs (e.g. Informatika III.B/III.C "Információ keresés gyak." ↔ "Osztott rendszerek gyak.", Wed 14:30) as `week_type='all'`; users correct these manually. Scraper-side parity detection fix stays in B7/Phase 6.
- Note: lint added to CI as non-blocking; pre-v3 debt (~30 errors in legacy files) queued in Phase 7. New Phase 0–1 files lint clean.

### Phase 2 — Data model migration (additive) — DONE 2026-07-12
- [x] Migration SQL written (2026-07-12): `supabase/migrations/002_v3_data_model.sql` — courses, events (id-preserving from `timetable_entries`, so `user_selections` stay valid; incl. `week_type_source` provenance per B7a), `user_course_selection`, `user_constraints`, `user_event_preferences`, indexes, RLS mirroring current model. **Awaiting user to run in Supabase SQL editor.**
- [x] Backfill included in the migration: courses from subject-name normalization (regex mirrors `getBaseSubjectName` in colors.ts exactly), event `type` from the e.a./gyak./szem./lab. suffix, `source_hash` per row for future diffing
- [x] Bonus: `v_split_slot_review` view — lists every group-slot with 2+ every-week events and classifies via the B7a signals (same teacher → alternates; same room → alternates; else ambiguous → review). This is the query-based verification the user prototyped, now living in the DB
- [x] Schema amendment (2026-07-12, pre-run so still just an edit to 002): `events.subject_name` added — the UI renders the original string verbatim, the "gyak."/"lab." suffix is not recoverable from `type`, and color hashing keys off it. Verified 002 against the live DB via REST: column names match `timetable_entries`, `uuid-ossp` present from 001, regex identical to `getBaseSubjectName`
- [x] Dual-read adapter in `shared/lib/api.ts` (2026-07-12): `entriesSource()` routes all entry reads to `events` once it exists AND is non-empty (probed once per session, `resetV3Detection()` to re-probe), else `timetable_entries`; `mapEventRowToEntry` maps rows back to the `TimetableEntry` shape (+ optional v3 fields `course_id`/`event_type`/`week_type_source`/`source_hash` in types.ts). Mobile planner's direct `timetable_entries` query rerouted through the shared API. Exception: `fetchTeacherTimetable` stays on the old table until Phase 6 (`events` has no `teacher_id`). Tests: `shared/lib/__tests__/apiDualRead.test.ts` (17 shared tests green, web typecheck green). **Reads switch over automatically the moment the migration is run — no further code change needed.**
- [x] Migration run by user in the Supabase SQL editor (2026-07-12)
- [x] Backfill verified (2026-07-12, `node scraper/verify_v3_migration.js`): events=1276=old count, 242 courses, all event→course links match the colors.ts normalization, `week_type_source` all `scraped`. 197 events have no type suffix (`other`) — expected (proj/named courses). `v_split_slot_review` found 6 split slots (Info III.B/C Wed 14:30, Számtech III.A/B Thu 8:00, Számtech IV.A/B Mon 8:00) — B7a teacher-view resolution queued for Phase 6 (edupage unavailable over summer break; scraper/original timetable imperfect, missing classes possible)
- ⚠️ Until Phase 6, the scraper still writes only `timetable_entries` — don't full re-scrape between running 002 and Phase 6, or re-run the 002 backfill section afterwards (it's `ON CONFLICT DO NOTHING`, safe to re-run for new rows)

### Phase 3 — Generator (pure logic first) — DONE 2026-07-12
- [x] `shared/lib/generator/` (exported from `@unitimetable/shared`): `types.ts`, `overlap.ts` (parity-aware conflict checks per B1), `build.ts` (TimetableEntry[] → units; unit = course×type, option = one cohort's events for that unit — finer subgroup/parity splitting deferred to Phase 4), `generate.ts` (DFS enumeration, fewest-options-first, branch-and-bound pruning on the monotone terms early/days/skips — gaps excluded from the bound since they can shrink; `maxCombos` 200k safety valve)
- [x] Scoring in `score.ts`: every term (gaps/early/days) computed per parity week and averaged — an odd-only gap costs exactly half (B6). Gaps < 60 min (10-min breaks, lunch) don't count as lyukasóra. Weights per B6 defaults (1.0/1.5/2.0) + `skipOptional` 4.0 for dropping an optional unit. Top-5 with event-set dedup, score ties labeled "azonos mutatók, másik csoportbeosztás"
- [x] Explanation builder (`explain.ts`, Hungarian, separated from logic for later i18n): per-schedule one-liner with deltas vs the best ("+1,5 óra lyukasóra", "1 nappal kevesebb")
- [x] Constraint-violation explainer per A15: sequential hard-filtering names the exact reason (day-not-allowed incl. the days the course exists on / outside-time-window / all-excluded / conflicts-with-locked / required-conflict naming both courses) with actionable resolutions; a required course that can't be scheduled returns issues + zero schedules (never a silently-broken schedule)
- [x] Lock/exclude semantics (A13) already in the core: excluded events remove options, locked events force their option — Phase 5 only needs to wire UI + persistence
- [x] Unit tests (25 new, 42 total in shared): full parity overlap matrix, gap/parity scoring, known-best fixtures, top-K/dedup/ordering, all issue paths, locks/exclusions, end-to-end from raw entries
- [x] Real-data smoke test (2026-07-12, live DB, Informatika III cohort): 28 entries → 9 units, 1,620 combos in ~60 ms, no truncation, sane top-5 — comfortably client-side per B6, no Web Worker needed at this scale

### Phase 4 — Planner stepper UI — DONE 2026-07-12 (core)
- [x] Stepper shell `web/src/components/PlannerWizard/` at `/wizard` (dock tab "Generáló", lazy chunk — timetable stays the critical path). State in `wizardStore.ts` (zustand + persist → resumable across reloads; generated results intentionally not persisted). Step chips clickable backwards, guarded forwards
- [x] Profil step = existing onboarding data embedded as summary (Part E #3 as recommended); "Csoport módosítása" → resetClassSelection → existing Welcome flow
- [x] Tárgyak step: cohort courses on by default (grouped by course, type+group counts shown), per-course opcionális chip + on/off switch, external search via `searchTimetableEntriesBySubject` + imported-subject chips (reuses appStore.importedSubjects so old Planner sees them too), Bővített (cross-major) toggle
- [x] Preferenciák step: day chips (Szombat only if data has it), time-window selects, 3 weight sliders seeded with B6 defaults
- [x] Generálás step: client-side run with live stats (verified in-browser: 10 489 combos / ~240 ms with an imported 8-option course), top-5 cards with parity-aware mini-preview (odd=left half, even=right half) + Hungarian explanations; §A15 issues render with action buttons that jump to the fixing step (verified: Szerda disabled → "Osztott rendszerek csak szerdán létezik" → Napok módosítása → recovery)
- [x] Véglegesítés step: day-by-day listing (time/room/teacher/parity), saves via `setSelections(eventIds)` — verified end-to-end in browser incl. Supabase `user_selections` rows and the Timetable rendering the result through the dual-read adapter (all reads confirmed hitting `events` in the network log)
- [x] Dock animation rebuilt without layout springs (2026-07-13, after "gunk in the mechanism" feedback persisted): root cause was framer layout animation + popLayout + width:auto retargeting each other mid-flight (smooth → slow → snap). Dock.tsx no longer uses `layout` or popLayout AT ALL — tab-specific buttons + search render inside ONE collapsible `.dock-extras` block keyed by activeTab; AnimatePresence mode="wait" sequences two plain width tweens (collapse 0.22s, then expand 0.22s, ease [0.4,0,0.2,1]); constants are static DOM. Hover/tap scale springs kept (they were fine). Verified with per-frame width sampling: monotonic curves easing into rest (…4,3,2,1,0 and …445,446,447), zero transforms on constant items during switch
- [x] Dock layout finalized (2026-07-13, user request): screen-specific buttons render to the LEFT of the constant block ([Órarend, Tervező, Beállítások, téma] pinned rightmost in fixed order) — the constant buttons no longer participate in layout animation at all; verified pixel-identical x positions across tab switches. Mobile menu lists constants first (separate ordering from the dock)
- [x] Dock & entry-point round (2026-07-13, user feedback): wizard is no longer a permanent tab — it's a planner-tab dock item ("Generáló" sparkles, `/wizard` route unchanged), since it replaces the old Planner in Phase 5 anyway. Dock item order restructured: theme toggle is ALWAYS last (anchored to the right edge — verified x stays identical across tab switches), tab-specific items swap in place before it. Dock animation de-jankified: layout springs firmly damped (550/42, was 320–400/26–30 — the underdamped tail read as "catching"), exits fast (0.12s easeIn) so they don't re-trigger layout mid-flight, dock-content width animates as a tween (springs on width re-layout every frame and land in steps)
- [x] UX polish round (2026-07-13, user feedback): profile shows "Informatika III. B csoport" (was duplicating faculty); weight sliders became question-style ("Mennyire zavarnak a lyukasórák?" etc.) with word answers (Egyáltalán nem → Nagyon), value 0–3 = generator weight, defaults 1/2/2; Szombat chip on Preferenciák only when an INCLUDED course has Saturday events (none in DB yet — appears automatically when the scraper delivers some); loader fades in/out via AnimatePresence (no more flash); modal height FIXED at min(700px, viewport) with internal scroll, overflow-x hidden; removed all scale transforms on bordered cards (they rendered blurry hairlines) — hover is border+shadow only, entrance is opacity+y spring. Verified in browser (light+dark): loader opacity mid-fade, fixed 860×700 modal, resumable step state after reload
- [x] Modal restyle (2026-07-12, user request): wizard renders as a dialog over the timetable (backdrop blur — glass on modals is §A5-legal; spring-in via motion; ✕/backdrop/Esc close → `/`), full-screen sheet under 768px. Animated loading: pulsing mini-timetable skeleton (`WizardLoader`, pure CSS, reduced-motion-safe) for pool loading AND a short scoring phase before results; schedule cards spring in staggered. Verified in browser: backdrop covers viewport, loader shows "Kombinációk pontozása…" mid-run, 5 cards stagger in
- Notes: courses stay ONE row per course in the Tárgyak list (e.a./gyak./szem. shown as info, generator schedules each part under the hood) — user-confirmed 2026-07-12. Manual week-type overrides (customEntries) are applied to the generator's input pool; `fetchTeacherTimetable` and old Planner untouched. Later (Phase 5/7): sync wizard prefs to `user_constraints`/`user_course_selection` tables (currently device-local), lock/exclude UI, old Planner retirement, deeper mobile pass. New files lint clean, web typecheck green

### Phase 5 — Smart editing — CORE DONE 2026-07-13
Decisions locked (Part E): #2 drag = valid-alternatives-only; #4 keep BOTH planners through Phase 5, hard-cut at the end.
- [x] Lock 🔒 / exclude ✕ per event in the wizard Edit step (`ScheduleGrid`), persisted to `user_event_preferences` (new api `fetchUserEventPreferences` / `setUserEventPreference` — upsert, row deleted when both flags false). Table is authoritative: loaded on wizard mount, write-through on every toggle. Lock and exclude are mutually exclusive. Verified: toggles persisted to Supabase (locked/excluded rows), reload restores them
- [x] "Javítás" (improve) = re-run `generateSchedules` with `lockedEventIds`/`excludedEventIds` (generator already supported these from Phase 3), replace picked schedule in place via `updatePicked`. Verified in browser: locked class kept, excluded class swapped out, "az órarendben van" warning clears, count preserved
- [x] Drag & drop between valid alternatives (`ScheduleGrid`, framer drag + manual rect hit-test on `onDragEnd`): grabbing a class reveals ghost targets at its OTHER groups' slots — green (free) / red (conflict, parity-aware). Drop on a free ghost swaps the whole option (`onSwapOption`); drop on conflict or empty space snaps back (`dragSnapToOrigin`). Locked/excluded/no-alternative cards aren't draggable. Verified end-to-end via synthesized PointerEvents: free-drop swaps event ids, conflict-drop rejected (schedule unchanged)
- [x] Robustness fix found during testing: a transient `fetchAvailableClassesForPlanner` failure returns `[]` (api swallows errors); guarded so an empty refetch can't wipe an already-loaded pool mid-edit (would blank the schedule)
- [ ] **Retire old slot-dropdown Planner** — DEFERRED per decision #4; hard-cut at end of phase after real use. Both flows live now (wizard = "Generáló" dock item on the planner tab)
- Files: `ScheduleGrid.tsx`, `editorModel.ts` (pure: units → per-class alternatives + parity-aware conflict flag), StepEdit rewritten, wizardStore + api extended. Web typecheck + lint clean, 42 shared tests green, production build green
- [x] Shared-lecture dedup fix (2026-07-13, user-reported): a lecture held for the whole year is scraped once PER group (A/B/C) with identical day/time/room/teacher — `buildUnitsFromEntries` was treating those as 3 distinct options, inflating the combination count and producing identical duplicate schedules. Now options within a unit are deduped by content signature (`day|start|end|weekType|room|teacher`); genuinely different same-time sessions (two labs, different rooms) stay distinct. New `homeClassId` config keeps the user's own group as the representative (so the saved entry is theirs) — threaded through StepGenerate, StepEdit/improve, editorModel/ScheduleGrid so generation and editing build IDENTICAL units (picked ids must map). StepCourses now derives its group counts from the same builder ("előadás" for a shared lecture, "(N csoport)" only when N>1). Live Informatika III: combos **1620 → 5**, 5 identical results → 5 distinct; verified in browser incl. drag still swaps. +3 tests (45 total)
- [x] Persist generated results + Edit-page redesign (2026-07-13, user feedback): the last generation result now lives in the wizard store (`genResult`/`genMeta`/`genInputSig`), so leaving the wizard and returning keeps the schedules; a stored input signature shows a "beállítások változtak" hint when settings changed since the run. Edit step redesigned: "Kész órarend" header with stat chips (nap/óra), compact icon+swatch legend (replaces the paragraph), course-color-tinted cards, crisp SVG lock/✕ buttons (were emoji), locked = accent ring, excluded = dimmed+strikethrough. Layout reworked to flex: modal body + step wrapper + edit panel fill height, the grid flexes to fit (217px @768h → 320px @900h) so the Save/Javítás row is always visible without scrolling; fixed a pre-existing time-gutter↔card misalignment (empty gutter head + matched margins). Verified across 768/900 heights: nav visible, no scroll, gutter aligned, drag still swaps, results survive navigation, other steps still scroll
- [x] Readability rework (2026-07-13, user: "hard to read, make it like the planner"): (1) Generálás cards are now click-anywhere-to-select (role=button + keyboard, hover highlight + "Kiválasztom →"), the separate button removed. (2) Edit grid rebuilt from proportional micro-positioning to a **slot-based grid like the classic Planner** — fixed 2-hour rows (`TIME_SLOTS`), only the slots the schedule actually uses are shown, roomy cells so full class names render (verified: long names like "Kriptográfia és adatbiztonság gyak." no longer clip). Day headers sticky, grid scrolls when the week is tall while the Save row stays pinned. (3) Draggability is now visible at rest via a persistent grip glyph (its absence = fixed class), not hover-only; lock/exclude/grip live in the card foot so the name gets full width. Verified in browser: names readable, cell-based drag ghosts (green free / red conflict) swap correctly, foot lock/exclude toggle, results persist. `editorModel`/generator dedup + homeClassId threading unchanged
- [x] Card simplification (2026-07-13, user: "just name/color, drop the details — time is on the edge, room/group don't matter on campus"): edit-grid cards now show only the course name (color-tinted); time and room removed (time is read off the row + gutter)
- [x] No-scroll + reorder (2026-07-13, user: "scrollable is a negative; move the guide to the bottom, grid fits first"): ghost drop-label changed from "↳ ide"/"✕ ütközik" to plain ✓/✕; grid rows `minmax(0,1fr)` + `overflow:hidden` so the whole week fits with NO scroll; StepEdit reordered — minimal header (title+chips) → grid (fills) → footer (status + legend/guide + Save/Javítás). To keep names readable in the now-shorter cells: the name fills the whole card (2-line clamp) with lock/exclude overlaid top-right (hover; always-on under `hover:none`), grip bottom-right (movable cards), parity pill bottom-left; edit modal height bumped 78vh→86vh. Verified via DOM on clean render (1200×760): cards 52px, 0/10 names clipped, no body scroll, grid above legend, Save row visible. Note: preview pane's render loop stalled this session (screenshots/live transitions timing out — a resource/jank artifact, not code: reloads always render the correct step, and the build passes), so the final screenshot + a re-run drag couldn't be captured; drag/ghost logic unchanged from the verified slot-grid rewrite
- [x] Card style match (2026-07-13, user: dark-mode edit cards looked washed/light-theme-ish; used the production-ui-polish skill): edit-grid cards now use the SOLID subject color as the full background with themed text (near-white in dark, dark in light) + shadow — the same visual language as the app's timetable `ClassCard` (consistency: "one component, one definition"). Was a washed `color-mix(color 12%, bg-elevated)` tint + colored left rail (dim/pale in dark). Controls restyled to read on the color (translucent-dark icon buttons, dark parity pill, shadowed grip). Also killed 4 pre-existing `transition: all` in the wizard CSS (named the specific props). Verified computed styles both themes: bg = solid subject color, text = var(--text-primary) adapting per theme; build green
- Remaining Phase 5 polish (before/with Phase 7): drag animation feel pass, keyboard-accessible swap (a11y), mobile day-carousel for the edit grid (currently a 5–6 col grid — fine on desktop, tight on phones), sync wizard prefs (`user_constraints`/`user_course_selection`) — still device-local

### Phase 6 — Sync & freshness
- [ ] Scraper: hash-based diff, upsert instead of wipe, swap-guard validation (B7)
- [ ] UI: "adatok frissítve: <date>" indicator, changed-entry highlight
- [ ] Semester dates to config (kills the hardcoded 2025/26 calendar)

### Phase 7 — Polish & performance
- [ ] Clear pre-v3 lint debt (~30 errors: any-typed props in App.tsx, ref-during-render in TimeLine, ts-ignore in legacy files) and flip CI lint back to blocking
- [ ] 60fps audit (React DevTools profiler on drag, generate, theme switch)
- [ ] Reduced-motion support, keyboard navigation in stepper & grid
- [ ] Bundle audit after three.js removal; lazy-load stepper route
- [ ] Update UI_AUDIT.md / this file; final regression pass over B4 list

---

## Part E — Open decisions (answer before the relevant phase)

1. ~~**Backgrounds & easter egg (Phase 0)**~~ **RESOLVED 2026-07-11:** base themes = Sapientia light + basic dark, clean, no effects. Animated backgrounds stay as lazy opt-in extras with a perf warning. Easter egg stays (off-able). Frosted glass only as optional "Dark Glass" theme, never on light. Seasonal themes (Christmas/Easter) must be addable as pure token overrides. See B5/B9.
2. **Drag & drop scope (Phase 5):** drag only between *valid alternatives* of the same course (recommended — matches constraint model), or free placement with validation errors?
3. **"Profile" step content (Phase 4):** is this the existing onboarding (faculty/year/group) embedded as step 1, or a separate account page? Recommendation: embed existing onboarding.
4. **Old Planner retirement (Phase 5):** hard cut or a toggle for one release? Recommendation: hard cut after a week of parallel use locally.
5. **`courses.is_optional` semantics:** spec puts it on the course, but optional-ness is per-user (`user_course_selection.is_required`). Recommendation: drop `is_optional` from `courses`, keep it purely per-user.

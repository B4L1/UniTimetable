# UniTimetable — What Was Fixed & Where To Go Next
*July 7, 2026 — follow-up to UI_AUDIT.md*

## 1. What was fixed in this pass

**Bugs**
- Planner dropdown: clicking "Nincs más opció" no longer deletes the selected class (explicit index check for the delete button)
- Planner dropdown: the week-type divider now actually renders ("Minden hetes órák" separator) instead of an invisible clickable row
- Save now does **one** batched `setSelections()` write instead of clear + N sequential writes (faster, no partial-wipe window)
- Image export restored: new "Exportálás képként" dock button on the Timetable tab (the whole export.tsx pipeline was unreachable before)
- Defined missing `--bg-tertiary` / `--bg-alt` tokens (with sapientia + faulty-terminal overrides) — ImportSubjectModal sections and react-select focus states now render correctly
- Onboarding uses `<Navigate>` instead of calling `navigate()` during render
- `resetApp` now removes only `unitimetable_*` keys instead of `localStorage.clear()`

**Consistency ("Apple scheme")**
- Inter font actually loaded in index.html; title `web` → `UniTimetable`, calendar-emoji favicon, meta description
- Radius sweep: all hardcoded `6/8/10/12/13/16px` radii now use `var(--radius-xs/sm/md/lg/pill)` (Google button's 24px kept intentionally, commented). Rogue 10px values standardized to the 12px `md` token
- Transition sweep: all ad-hoc `0.2s ease` / `0.3s ease` now use `var(--transition)` / `var(--ease)`; the checkbox bounce promoted to a proper `--ease-bounce` token
- Theme toggle logic extracted to `src/utils/theme.ts` (was copy-pasted 3× with disagreeing theme lists); Welcome's inverted Sun/Moon icon fixed — all toggles now show the mode you'll switch **to**

**Dead code removed**
- `components/Plasma.tsx` + `.css`, `backgrounds/Plasma.tsx`, `App.css` (Vite scaffold), `lib/utils.ts`
- Dead CSS: `.nav-btn`/`.header-nav`, `.dropdown-clear-btn`, `.light-mode` dock rules, duplicate `.dock-content` block, duplicate `--sap-*` variable block
- Timetable: unused `loadHtml2Canvas`, `getSlotIndex`, `usePrevious`, `carouselRef`; App: unused dead handlers; Planner: unused store actions, ~20 debug `console.log`s
- Silk/Beams/Dither backgrounds no longer eagerly preloaded (heavy three.js chunks; they weren't selectable)
- package.json pruned: `i18next`, `react-i18next`, `jwt-decode`, `@types/jwt-decode`, `@types/react-select`, `clsx`, `tailwind-merge`, `class-variance-authority`

## 2. Before you commit — validate

I couldn't run the toolchain from here, so please run:

```
pnpm install          # updates lockfile after dep pruning
pnpm --filter @unitimetable/web typecheck
pnpm --filter @unitimetable/web lint
pnpm --filter @unitimetable/web build
```

Then click through: planner dropdown (add/replace/delete, the divider, "Nincs más opció"), save, theme toggle on Login/Welcome/dock, timetable export button, Tárgy kezelés modal, app reset.

## 3. Repo hygiene (needs your OK — deletions)

- Root `app/`, `components/`, `i18n/`, `global.css`, `tailwind.config.js` — the abandoned Expo Router app (imports paths that don't exist; can't build)
- `test-expo/` at workspace root — throwaway test project with committed `.gradle`/`.cxx` build artifacts
- ~30 scraper scratch files at repo root (`all_*.json`, `friday_*.json`, `divs.txt`, `*_typecheck*.log`, `teacher_debug.png`, …) → delete or move to `scraper/debug/` and gitignore
- Duplicate docx (`Projekt leírás és motiváció.docx` vs `Projekt_leírás_és_motiváció.docx`)

Say the word and I'll clean these up.

## 4. Improvements worth doing next (code quality)

1. **Toast system** — Planner has a nice motion-based toast; extract it into a `<Toast>` component and replace the 8 `alert()`/`confirm()` calls (Settings, ImportSubjectModal, Welcome, shared-groups info). Biggest remaining "feel" upgrade.
2. **Semester calendar is hardcoded** (`utils/calendar.ts`, 2025/26 dates). Next September the week-parity display silently goes wrong. Move the dates to a Supabase `config` table or at least a single `semesters.ts` you update yearly. Also worth handling the `out_of_term` case visibly in the UI.
3. **Shared constants** — `TIME_SLOTS`, `DAYS`, `getMinutes`, and the slot-overlap span logic are quadruplicated (Timetable, Planner, export, mobile). Move to `@unitimetable/shared`; the planner/timetable disagree-someday bug class disappears.
4. **ImportSubjectModal → CSS classes** — still ~40 inline style objects; convert to `.glass-card`/`.btn` + a small module CSS so themes (esp. sapientia/faulty-terminal) style it properly.
5. **Language decision** — everything is hardcoded Hungarian and i18n deps are now removed. Either commit to HU-only, or reintroduce react-i18next properly (the old Expo app's `i18n/hu.ts`/`en.ts` files are a usable starting point). An EN version widens the audience to Erasmus students.
6. **Preferences sync** — only `show_time_indicator` + light/dark reach Supabase; `backgroundTheme` (specific), `invertWeekParity` and unlocked easter egg don't follow the user across devices. Extend the `user_preferences` schema.
7. **Tests + CI** — zero tests today. Start with pure logic: `getAcademicWeek`, slot-span calculation, planner dedup/selection rules. A GitHub Action running typecheck + lint + vitest on push is ~30 lines.
8. **Error tracking** — the ErrorBoundaries log to console only; wire Sentry (free tier) so real-user crashes are visible.

## 5. Product next steps (roughly in order of value/effort)

1. **PWA** — vite-plugin-pwa + manifest + service worker. Students check timetables offline in hallways; you already cache entries in localStorage, so this is mostly config. Installable on phones without the whole Expo mobile app.
2. **ICS / Google Calendar export** — you already have entry → time-slot mapping; generating an `.ics` (with odd/even-week RRULEs) makes the timetable live in students' real calendars. Pairs with the existing Google login.
3. **Class-change notifications** — "next class in 15 min, room 214" via web push (needs the PWA service worker anyway).
4. **Friend/group timetable compare** — you built sharing scripts already; a "compare with a friend" view showing common free slots is a killer feature for group project scheduling.
5. **Teacher flow** — Login currently hardcodes `role: 'student'` (TEMP comment). The teacher timetable fetch already exists in shared; finish the role assignment and onboarding branch.
6. **Scraper automation** — schedule the scraper (GitHub Action cron) so the Supabase data refreshes itself when the university updates the PDF, instead of manual runs.
7. **Mobile app parity** — packages/mobile lags behind web; once web stabilizes, port the ClassCard/planner improvements and the shared constants extraction makes that mostly free.

My suggestion for the next session: PWA + ICS export (high value, low effort, builds on what exists), plus the calendar-date de-hardcoding before the semester rolls over.

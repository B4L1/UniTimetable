# UniTimetable — Web UI & Code Audit
*July 7, 2026 — covers `packages/web` in depth, plus repo-level dead files.*

The good news: you already have a real token system in `src/index.css` (`--radius-xs/sm/md/lg/pill`, `--shadow-sm..xl`, `--transition`, `--ease`) and most core components use it. The issues below are mostly places that bypass those tokens, plus a handful of real bugs.

---

## 1. Design consistency (the "Apple scheme" check)

### 1.1 Hardcoded radii bypassing the token scale
Your scale is 6 / 8 / 12 / 16 px. These use raw values (some off-scale):

| Location | Value | Should be |
|---|---|---|
| `App.tsx:430, 450` (dock search input + label) | `10px` | `var(--radius-md)` (12) or `--radius-sm` |
| `Welcome.tsx:251` (import button) | `10px` | token |
| `ImportSubjectModal.tsx` (~15 places) | `8/10/12/16px` mixed | tokens |
| `Planner.tsx:1222` (mobile search) | `8px` | `var(--radius-sm)` |
| `Planner.tsx:1430, 1482` (GlareHover buttons) | `"8px"` | `var(--radius-sm)` |
| `Settings.tsx:223, 237, 249` (selects) | `8px` | `var(--radius-sm)` |
| `Onboarding.tsx:142` (react-select) | `8px` | token |
| `Login.css:87` (Google button) | `24px` | intentional (Google spec) — fine, comment it |
| `MobileMenu.css:73, 103` | `12px`, `6px` | `--radius-md`, `--radius-xs` |
| `index.css:745` (toggle) | `13px` | `var(--radius-pill)` |
| `sapientia.css:56, 90` | `12px`, `16px` | `--radius-md`, `--radius-lg` |
| `AnimatedList.css:41, 53` | `8px`, `10px` | tokens |

`10px` isn't even on your scale — it appears 6+ times. Deciding "10px things become 12px" and doing a sweep would unify ~90% of this.

### 1.2 Transitions/easing not using tokens
`--transition: 0.2s cubic-bezier(0.4,0,0.2,1)` exists, but ~25 rules use ad-hoc `0.2s ease` / `0.3s ease` (index.css:530, 667, 751, 835, 909, 922, 1239, 1272; ClassCard.css:16, 227; Dock.css:37; Login.css:8, 46, 92; MobileMenu.css:52, 78; AnimatedList.css:52, 64; sapientia.css:98). `ease` vs your material curve is a subtly different feel — this is exactly the kind of thing that makes the UI feel "almost but not quite" uniform. MobileMenu.css:108 uses a bouncy `cubic-bezier(0.175,0.885,0.32,1.275)` for the checkbox — if you like the bounce, promote it to a token (`--ease-bounce`) so it's a deliberate part of the system.

### 1.3 Theme-toggle icon logic is inconsistent (user-visible)
- Dock (`App.tsx:344`): dark mode shows **Sun** (i.e., "click to go light")
- Login (`Login.tsx:124`): dark shows **Sun** ✓ consistent
- Welcome (`Welcome.tsx:147`): dark shows **Moon** — inverted vs the other two

### 1.4 Triplicated theme-toggle code
`LAST_DARK_THEME_KEY`, `DARK_THEMES`, `withViewTransition()`, Sun/Moon icons are copy-pasted in `App.tsx`, `Login.tsx`, and `Welcome.tsx` — and the copies disagree: App's `DARK_THEMES` omits `silk/beams/dither`, Login/Welcome include them. Extract to `src/utils/theme.ts` + shared icon components.

### 1.5 Typography: Inter is never loaded
`body { font-family: 'Inter', ... }` (index.css:86) but `index.html` only loads VT323. Everyone silently gets Segoe UI/system font. Either add the Inter `<link>` or drop it from the stack.

### 1.6 `index.html` polish
Title is `web`, favicon is the default `vite.svg`. Set a real title + icon.

### 1.7 ImportSubjectModal is the odd one out
It's built entirely from inline styles (~40 style objects), duplicating what `.glass-card`, `.btn`, tokens already provide. It's the least "on-scheme" screen — worth converting to the shared classes.

### 1.8 Undefined CSS variables (silent styling failures)
- `var(--bg-tertiary)` — used at `ImportSubjectModal.tsx:163, 288`, defined nowhere → background resolves to nothing.
- `var(--bg-alt)` — used at `Onboarding.tsx:154` (react-select focus state), defined nowhere (you have `--sap-bg-alt` only) → no hover highlight on options.

---

## 2. Bugs

### 2.1 Clicking "Nincs más opció" deletes the selected class (Planner.tsx:1497–1513)
The empty-state message is an item inside `AnimatedList`; `onItemSelect` treats any `adjustedIndex >= dropdownOptions.length` as the delete button, so clicking the info text calls `selectClass(null)` and clears the slot. Give the delete button an explicit index check, or handle it only via its own `onClick`.

### 2.2 Week-type divider never renders (Planner.tsx:1441–1442)
`dropdownOptions` inserts `{ id: 'divider-replace', isDivider: true }`, but the item mapper does `if ('isDivider' in item) return null` — so users see no separator between compatible and full-week classes, just an empty (still hoverable/clickable) row rendered by AnimatedList. The `.dropdown-divider` CSS (index.css:1146) is orphaned. Render the divider element instead of `null`.

### 2.3 Save does N+1 sequential network writes (Planner.tsx:129–152)
`saveSelections` calls `clearSelections()` (remote write of `[]`) then `addSelection(id)` per entry — each one a Supabase `updateUserSelections` round-trip. Besides being slow, if the tab closes mid-loop the user's saved selections are partially wiped. You already have `setSelections(entryIds)` in the store that does it in one write — use it.

### 2.4 Image export is unreachable (App.tsx)
`DownloadIcon` (App.tsx:123), `handleExportImage` (313), `timetableExportRef`, and the entire 558-line `export.tsx` pipeline (plus the `@react-pdf/renderer` + `pdfjs-dist` dependencies) are fully wired on the Timetable side — but no dock item or menu entry ever triggers it. Looks like the export button was lost in a refactor. Re-add `{ icon: <DownloadIcon/>, label: 'Exportálás', onClick: handleExportImage }` to the timetable dock items, or delete the feature.

### 2.5 `navigate()` during render (Onboarding.tsx:94–97)
`if (!user) { navigate('/login'); return null; }` runs in the render body — React Router warns and this can misbehave under StrictMode. Use `<Navigate to="/login" />` instead.

### 2.6 `resetApp` nukes unrelated localStorage (webStorage.ts:93)
`reset()` calls `localStorage.clear()`, which also wipes `uni-last-dark-theme` and anything else on the origin. Remove only the `unitimetable_*` keys.

### 2.7 Settings class change doesn't hide old data instantly
Minor: `Settings.handleClassSelect` updates `selectedClass` but not `user.selectionId`; consistency depends on the server round-trip via `upsertUserPreferences`. Works, but worth a comment or explicit sync.

### 2.8 Debug logging left in production paths
20 `console.log`s (Planner's `loadDefaults` alone has ~15, including `console.error("DEFAULTS IS STILL EMPTY...")`), and 8 `alert()`/`confirm()` calls used as UI. You already built a nice toast system in Planner — the alerts in Settings/ImportSubjectModal/Welcome (`alert('Sikeresen importálva...')` etc.) would feel much more "Apple" as toasts.

---

## 3. Unused / dead code

### In `packages/web/src`
- **`components/Plasma.tsx` + `Plasma.css`** and **`components/backgrounds/Plasma.tsx`** — Plasma theme was removed from BackgroundSelector ("Plasma wrapper removed"); nothing imports either copy.
- **Silk, Beams, Dither backgrounds** — valid in the type and lazy-loaded, but not offered in Settings' theme list and not in App's cycle list. Worse, `BackgroundSelector`'s `useEffect` **eagerly preloads all 8 backgrounds** including these three (three.js + postprocessing chunks) on every app start. Either expose them as themes or remove them and their heavy deps.
- **`App.css`** — Vite scaffold leftover (`.logo`, `logo-spin`), never imported.
- **`lib/utils.ts` (`cn`)** — never imported; `clsx` + `tailwind-merge` deps exist only for it.
- **Dead CSS in `index.css`**: `.nav-btn`/`.header-nav` block (old header nav, replaced by Dock), `.dropdown-divider` rules, `.dropdown-clear-btn`.
- **`Timetable.tsx`**: `loadHtml2Canvas()` (lines 50–68, superseded by export.tsx), `getSlotIndex()` (line 29), `usePrevious()` (line 673) — all unused.
- **`App.tsx`**: `toggleTheme`, `handleSave`, `handleExportImage` defined in `App()` (176–190) are dead — `MainAppLayout` redefines its own; `isFaultyTerminalUnlocked` destructured and unused.
- **Duplicate CSS blocks**: `.dock-content` defined twice verbatim (Dock.css:114 and 125); the `--sap-orange/blue/red/teal/lime` group defined twice (sapientia.css:10–22).
- **Unused dependencies** (`packages/web/package.json`): `i18next`, `react-i18next` (zero usage in web — all strings are hardcoded Hungarian), `jwt-decode`, `@types/jwt-decode`, `@types/react-select` (react-select ships its own types). `clsx`/`tailwind-merge` if you drop `lib/utils.ts`.

### Repo level (`unitimetable/`)
- Root **`app/`, `components/`, `i18n/`, `global.css`, `tailwind.config.js`** — an old Expo Router app superseded by `packages/mobile`; `app/_layout.tsx` imports `@/stores/appStore`, `@/constants/Colors`, `@/hooks/useTheme` which don't exist at root, so it can't even build. Safe to delete.
- ~30 scraper scratch files at root: `all_*.json`, `friday_*.json/txt`, `end_*.json`, `class_4*.json`, `divs.txt`, `repeats.txt`, `analyze_*.js`, `teacher_debug.png`, `mobile_typecheck*.log`, `install_error.txt`, etc. Move into `scraper/debug/` or delete; at minimum gitignore.
- Empty root `mobile/` directory; `test-expo/` (whole throwaway Expo test project with committed `.gradle`/`.cxx` build artifacts) at the workspace root.

---

## 4. Suggested order of attack
1. Fix the two Planner dropdown bugs (2.1, 2.2) and the save N+1 (2.3) — user-facing correctness.
2. Restore the export button (2.4) or delete export.tsx + 2 deps.
3. Define `--bg-tertiary`/`--bg-alt` or replace their usages (1.8); load Inter (1.5).
4. Radius/transition token sweep (1.1, 1.2) — mechanical, big consistency win.
5. Extract shared theme-toggle util (1.3/1.4) and fix Welcome's inverted icon.
6. Dead-code deletion pass (§3) — shrinks bundle noticeably (Plasma + Silk/Beams/Dither preloads).

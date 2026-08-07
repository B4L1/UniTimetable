# UniTimetable Mobile + Widget — What Was Built & How To Run It
*July 7, 2026 — packages/mobile*

## What changed

**The app was un-broken.** It couldn't build/run before because:
- `app/_layout.tsx` was left as a "MINIMAL LAYOUT WORKS" debug screen — no router, and the store's `initialize()` was never called → rewritten as a proper root layout (init + Stack).
- `hooks/useTheme.ts` imported `@/components/themes`, a module that never existed → rewritten on top of a new `constants/theme.ts`.
- The widget was never registered: `app.json` had no `react-native-android-widget` plugin entry, so `UniWidget` never appeared in the manifest (your `packages/widget-app` experiment had this part right — it's now merged in).

**Web-matching style.** New `constants/theme.ts` mirrors the web tokens exactly (`#12121a` background, `#1a1a24` cards, `#6366f1` accent, radius 6/8/12/16). All screens swapped from the old `#0f0f23` palette. Timetable cards are now subject-colored via the same `getSubjectColor` the web uses, with the same week badges.

**Shared calendar.** New `packages/shared/lib/calendar.ts` — the official 2025/26 semester dates, used by web-style parity logic. This also fixed a real bug: mobile assumed the semester started Feb 9, web says Feb 16 → the two showed different odd/even weeks.

**The widget** (`packages/mobile/widget/`):
- `widget-data.ts` — builds the list of current/upcoming classes: looks ahead 14 days, respects odd/even week parity (including across the week boundary), knows "Ma"/"Holnap", detects a currently running class.
- `WidgetUI.tsx` — visual match of the web ClassCard: dark card shell, subject-colored inner card, subject/teacher/room/time, week badge, "● MOST" (green) vs "KÖVETKEZŐ • Ma" header. Since Android widgets can't swipe, there are ‹ › arrow buttons in the corner plus a 2/6 position indicator; arrows grey out at the ends. Tapping the card opens the app.
- `widget-task-handler.tsx` — reads the timetable **automatically** from the same cache the app writes (no more manual JSON import; the Widget tab is deleted). Periodic updates (every 30 min, Android's minimum) snap back to the current/next class.
- `widget-sync.tsx` — the app pushes fresh data to the widget after every timetable fetch (timetable screen + settings group change).

Also cleaned out: the manual-import Widget tab, `expo-document-picker`/`expo-file-system` deps, debug logs/screenshots (`crash_log.txt`, `build_error.log`, …).

## How to build & test

```bash
pnpm install                          # deps changed (removed 2)

cd packages/mobile
npx expo prebuild --platform android --clean   # regenerates android/ with the widget in the manifest
npx expo run:android                           # build + install on device/emulator
```

The `--clean` prebuild matters: the widget receiver only gets added when the config plugin runs.

**Test checklist**
1. App opens → onboarding (or timetable if a group was chosen before); pick your group.
2. Timetable shows subject-colored cards, correct odd/even week label.
3. Long-press home screen → Widgets → UniTimetable → place it.
4. Widget shows the current class (green ● MOST) or the next one; ‹ › steps through upcoming classes; tapping the card opens the app.
5. Change group in Settings → widget updates within a second.
6. iOS: `npx expo run:ios` — the app works, widget code no-ops (Platform-guarded).

## Known limitations / next steps

- **No horizontal swipe on the widget** — Android RemoteViews physically don't support swipe gestures; arrows are the standard workaround. A vertically scrollable list variant (`ListWidget`) could be added for taller widget sizes.
- ~~Subject colors assigned in encounter order~~ — **done**: colors are now hash-deterministic (`shared/lib/colors.ts`). App, widget and web assign the full subject set in one sorted batch, so the same subject always gets the same color, with collision-probing keeping subjects visually distinct.
- **Widget shows the full class timetable**, not planner selections — same as the mobile app's timetable screen. When the mobile app gains login + planner sync, point `widget-data.ts` at the selected-entries cache.
- **Web still has its own calendar copy** (`web/src/utils/calendar.ts`) — migrate it to the new `@shared/calendar` and delete the copy.
- iOS widget would need a native WidgetKit extension (Swift) — separate effort, not covered by react-native-android-widget.
- **Visual restyle to Blueprint v4 done** (2026-08-07): tokens, fonts, and the
  subject-colour-on-a-bar card treatment now match web across all screens and
  the widget. Feature parity (PlannerWizard, ClassDetailModal, subject import,
  toasts) is still open — see `docs/superpowers/specs/2026-08-07-mobile-blueprint-v4-restyle-design.md`.

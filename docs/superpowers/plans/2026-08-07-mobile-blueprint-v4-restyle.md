# Mobile Blueprint v4 Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `packages/mobile` (Expo Router RN app + Android widget) from its
old glass/indigo look to the web app's current "Blueprint v4" design system —
opaque hairlines, 2px radii, Sapientia-green accent, Outfit/JetBrains Mono
fonts — without touching business logic, and clean up two confirmed-dead parts
of the repo along the way.

**Architecture:** Single source-of-truth token file
(`packages/mobile/constants/theme.ts`) gets rewritten with the exact hex/rgba
values from `packages/web/src/index.css`. Every screen and the widget already
either imports `palette`/`radius` from that file, or has its own hardcoded
hex duplicating the old palette — both get swept to the new tokens. The
subject-color-as-card-fill pattern (pre-v4) is replaced with subject-color-as-
top-bar (v4), matching web's `ClassCard.css` change, in the two places that
render class cards: `timetable.tsx` and the widget.

**Tech Stack:** Expo Router (RN 0.81), Zustand, `@expo-google-fonts/outfit` +
`@expo-google-fonts/jetbrains-mono` (new deps), `react-native-android-widget`
(existing widget renderer — RemoteViews-based, no custom font support).

## Global Constraints

- No test suite exists for `packages/mobile`; the verification gate for every
  task is `pnpm --filter @unitimetable/mobile typecheck` passing, plus a grep
  sweep confirming no leftover old-palette hex values in touched files. Do not
  invent RN component tests — none exist and this is a styling-only pass.
- Radius is `2px` everywhere per Blueprint v4 (`--radius-xs/sm/md/lg` all
  resolve to 2 on web). Do not introduce new radius values.
- Color tokens (exact values, from `packages/web/src/index.css`):
  `bgApp #08090a` · `bgSurface #0c0e10` · `bgElevated #131619` ·
  `bgInset #050506` · `borderSubtle #1c1f23` · `borderDefault #26292e` ·
  `borderStrong #383c43` · `gridLine #16181b` · `textPrimary #edeef0` ·
  `textSecondary #969ba3` · `textTertiary #5f646c` · `accent #3fbb7d` ·
  `accentHover #5ed296` · `accentSubtle rgba(63,187,125,0.12)` ·
  `accentLine rgba(63,187,125,0.4)` · `danger #e5534b` · `warning #d99a2b`.
- Fonts: `Outfit` (prose/UI text), `JetBrains Mono` (times, rooms, counts,
  codes) — per `DESIGN_SYSTEM.md` rule 4.
- State (selection/active) is shown via a 2px accent rail on an edge, never a
  filled block — per `DESIGN_SYSTEM.md` §4.
- Subject color lives on a bar (top, for grid class cards), never as a card
  fill — per `DESIGN_SYSTEM.md` §3.
- Do not touch `packages/shared/`, `packages/web/`, or app logic/data-fetching
  code in `packages/mobile` — this pass is styling-only. Do not add PlannerWizard,
  ClassDetailModal, subject import, or toasts — those are Phase 2, out of scope.
- Every commit is scoped to one task; do not bundle unrelated file changes.

---

### Task 1: Repo cleanup — delete dead code

**Files:**
- Delete: `packages/widget-app/` (entire directory — superseded by `packages/mobile/widget/`)
- Delete: `app/`, `components/`, `i18n/`, `global.css`, `tailwind.config.js` (repo root)
- Delete: `app.json`, `components.json`, `tsconfig.json` (repo root — these
  three only configure the orphaned root Expo app: `app.json` has
  `slug: "unitimetable"` and points at `./assets/images/*`; `components.json`
  is a shadcn config pointing at `tailwind.config.js`/`global.css`;
  `tsconfig.json` extends `expo/tsconfig.base` with `@/*` paths matching the
  deleted `app/` tree. None are referenced by `pnpm-workspace.yaml`, which
  only globs `packages/*`, or by any `packages/*/package.json`.)

**Interfaces:** None — this task has no code dependents. Do this first so later
tasks aren't confused by dead files when searching the repo.

- [ ] **Step 1: Confirm nothing outside the doomed set references these paths**

Run (from repo root):
```bash
grep -rn "widget-app" --include=*.json --include=*.js --include=*.ts --include=*.tsx . \
  --exclude-dir=node_modules --exclude-dir=.git
grep -rln "tailwind.config\|components.json\|global.css" --include=*.json . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=packages
```
Expected: only matches inside `packages/widget-app/` itself and the root files
being deleted (`components.json` referencing `tailwind.config.js`/`global.css`
is expected and fine — all three are being deleted together).

- [ ] **Step 2: Delete the directories and files**

```bash
rm -rf packages/widget-app
rm -rf app components i18n
rm -f global.css tailwind.config.js app.json components.json tsconfig.json
```

- [ ] **Step 3: Verify the workspace still resolves**

Run: `pnpm install`
Expected: completes without error, lockfile updates to drop `widget-app`'s
now-absent workspace entry (no manual `pnpm-lock.yaml` editing needed — pnpm
handles it).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove superseded widget-app package and orphaned root Expo app"
```

---

### Task 2: Design tokens + font infrastructure

**Files:**
- Modify: `packages/mobile/constants/theme.ts` (full rewrite)
- Modify: `packages/mobile/package.json` (add font deps)
- Modify: `packages/mobile/app/_layout.tsx` (load fonts, hold splash screen)
- Delete: `packages/mobile/constants/Colors.ts` — deferred to Task 7 (still
  imported by `onboarding.tsx` until that task removes the import; deleting it
  now would break typecheck)

**Interfaces:**
- Produces: `palette` object with keys `bgApp, bgSurface, bgElevated, bgInset,
  borderSubtle, borderDefault, borderStrong, gridLine, textPrimary,
  textSecondary, textTertiary, accent, accentHover, accentSubtle, accentLine,
  danger, warning, success` (all string hex/rgba). `radius` object with keys
  `xs, sm, md, lg, pill` (all number, first four = 2, pill = 999). `spacing`
  object unchanged (`xs:4, sm:8, md:12, lg:16, xl:24`). New `fonts` object with
  keys `sans, sansMedium, sansSemiBold, sansBold, mono, monoMedium, monoBold`
  (string font-family names). All later tasks import these four from
  `@/constants/theme`.
- Consumes: nothing.

- [ ] **Step 1: Rewrite `packages/mobile/constants/theme.ts`**

```ts
// Design tokens — mirrors packages/web/src/index.css (Blueprint v4) so the
// mobile app matches the web app exactly. Keep the two in sync.

export const palette = {
    // Surfaces — opaque, stepped by value (dark only; mobile has no light theme yet)
    bgApp: '#08090a',
    bgSurface: '#0c0e10',
    bgElevated: '#131619',
    bgInset: '#050506',

    // Hairlines — opaque, not alpha
    borderSubtle: '#1c1f23',
    borderDefault: '#26292e',
    borderStrong: '#383c43',
    gridLine: '#16181b',

    // Text
    textPrimary: '#edeef0',
    textSecondary: '#969ba3',
    textTertiary: '#5f646c',

    // Accent — Sapientia green
    accent: '#3fbb7d',
    accentHover: '#5ed296',
    accentSubtle: 'rgba(63, 187, 125, 0.12)',
    accentLine: 'rgba(63, 187, 125, 0.4)',

    // Status
    danger: '#e5534b',
    warning: '#d99a2b',
    success: '#3fbb7d',
} as const;

// Radius — one value. All names resolve to 2px, matching web's --radius-* tokens.
export const radius = {
    xs: 2,
    sm: 2,
    md: 2,
    lg: 2,
    pill: 999,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
} as const;

// Loaded via @expo-google-fonts in app/_layout.tsx — see useFonts() there.
export const fonts = {
    sans: 'Outfit_400Regular',
    sansMedium: 'Outfit_500Medium',
    sansSemiBold: 'Outfit_600SemiBold',
    sansBold: 'Outfit_700Bold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
    monoBold: 'JetBrainsMono_700Bold',
} as const;

export type Palette = typeof palette;
```

- [ ] **Step 2: Add font packages to `packages/mobile/package.json`**

Add to `dependencies` (alphabetical, matching existing style):
```json
    "@expo-google-fonts/jetbrains-mono": "^0.4.1",
    "@expo-google-fonts/outfit": "^0.4.1",
    "expo-font": "~14.0.9",
    "expo-splash-screen": "~31.0.11",
```
Run `pnpm --filter @unitimetable/mobile info expo-font expo-splash-screen` if
unsure of the version pinned by the installed Expo SDK (~54) — match whatever
`expo install expo-font expo-splash-screen` would resolve to, since Expo SDK
versions are tightly coupled. Prefer running:
```bash
cd packages/mobile
npx expo install expo-font expo-splash-screen @expo-google-fonts/outfit @expo-google-fonts/jetbrains-mono
```
This lets Expo pin correct versions automatically instead of hand-typing them.

- [ ] **Step 3: Wire font loading into `packages/mobile/app/_layout.tsx`**

Replace the full file with:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { useAppStore } from '@/stores/appStore';
import { palette } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, isLoading } = useAppStore();
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    initialize();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded || isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: palette.bgApp, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bgApp },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
```

Note `palette.bgPrimary` → `palette.bgApp` (renamed token, matches Task 2 Step 1).

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: fails only on files not yet updated in this task (`(tabs)/_layout.tsx`,
`onboarding.tsx` referencing old token names like `palette.bgCard`,
`palette.glassBorder`, `Colors`) — those are fixed in Tasks 3 and 7. Confirm the
*only* errors are in those two files and concern the renamed token names, not
`theme.ts` or `app/_layout.tsx` themselves.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/constants/theme.ts packages/mobile/package.json \
  packages/mobile/app/_layout.tsx pnpm-lock.yaml
git commit -m "feat(mobile): rewrite design tokens to Blueprint v4, add Outfit/JetBrains Mono fonts"
```

---

### Task 3: Root nav chrome — tab bar

**Files:**
- Modify: `packages/mobile/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `palette` from Task 2 (`bgSurface`, `borderDefault`, `accent`,
  `textSecondary`), `fonts` from Task 2 (`sansMedium`).
- Produces: nothing new — leaf UI.

- [ ] **Step 1: Update token references and tab bar chrome**

In `packages/mobile/app/(tabs)/_layout.tsx`, replace:
```tsx
import { palette, radius } from '@/constants/theme';
```
with:
```tsx
import { palette, fonts } from '@/constants/theme';
```
(`radius` isn't used in this file — dropped rather than left unused.)

Replace `tabBarActiveTintColor: palette.accentHover,` with
`tabBarActiveTintColor: palette.accent,` (hover variant doesn't apply to touch).

Replace the `styles` block:
```tsx
const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: palette.bgSurface,
        borderTopColor: palette.borderDefault,
        borderTopWidth: 1,
        paddingTop: 8,
        paddingBottom: 8,
        height: 65,
    },
    tabBarLabel: {
        fontSize: 12,
        fontWeight: '500',
        fontFamily: fonts.sansMedium,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 22,
        opacity: 0.6,
    },
    iconFocused: {
        opacity: 1,
    },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: no errors referencing `(tabs)/_layout.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "packages/mobile/app/(tabs)/_layout.tsx"
git commit -m "feat(mobile): restyle tab bar to Blueprint v4 tokens"
```

---

### Task 4: Timetable screen restyle

**Files:**
- Modify: `packages/mobile/app/(tabs)/timetable.tsx`

**Interfaces:**
- Consumes: `palette`, `radius`, `fonts` from Task 2.
- Produces: nothing new — leaf UI.

- [ ] **Step 1: Update the import line**

Replace:
```tsx
import { palette, radius } from '@/constants/theme';
```
with:
```tsx
import { palette, radius, fonts } from '@/constants/theme';
```

- [ ] **Step 2: Replace the class card JSX with the bar-on-top treatment**

Replace the `slotEntries.map((entry, i) => { ... })` block (lines 234-267 in
the current file) with:

```tsx
                                                slotEntries.map((entry, i) => {
                                                    const subjectColor = getSubjectColor(entry.subject_name);
                                                    return (
                                                    <View key={i} style={styles.classCard}>
                                                        <View style={styles.classCardBar}>
                                                            <View
                                                                style={[
                                                                    styles.classCardBarHalf,
                                                                    { backgroundColor: subjectColor, opacity: entry.week_type === 'even' ? 0.35 : 1 },
                                                                ]}
                                                            />
                                                            <View
                                                                style={[
                                                                    styles.classCardBarHalf,
                                                                    { backgroundColor: subjectColor, opacity: entry.week_type === 'odd' ? 0.35 : 1 },
                                                                ]}
                                                            />
                                                        </View>
                                                        <View style={styles.classCardContent}>
                                                            <Text style={styles.className} numberOfLines={2}>
                                                                {entry.subject_name}
                                                            </Text>
                                                            {entry.teacher_name && (
                                                                <Text style={styles.classTeacher} numberOfLines={1}>
                                                                    {entry.teacher_name}
                                                                </Text>
                                                            )}
                                                            <View style={styles.classRoomRow}>
                                                                <Text style={styles.classRoom}>
                                                                    {entry.classroom}
                                                                </Text>
                                                                {entry.week_type !== 'all' && (
                                                                    <Text style={styles.weekBadge}>
                                                                        {entry.week_type === 'odd' ? '1. hét' : '2. hét'}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                    );
                                                })
```

(Week parity in the bar: odd weeks are full-opacity on the left half and
knocked back on the right; even weeks the reverse; `'all'` entries never match
either condition so both halves stay full opacity — a solid bar. This mirrors
`DESIGN_SYSTEM.md` §3's "week parity lives in the bar" rule.)

- [ ] **Step 3: Replace the full `styles` block**

```tsx
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.bgApp,
    },
    // Day selector
    daySelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 8,
    },
    dayPill: {
        width: 48,
        height: 36,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.bgSurface,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
    },
    dayPillActive: {
        borderColor: palette.accent,
        borderBottomWidth: 2,
    },
    dayPillText: {
        fontSize: 15,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
    },
    dayPillTextActive: {
        color: palette.accent,
    },
    // Header
    header: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    dayTitle: {
        fontSize: 24,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
    },
    weekType: {
        fontSize: 13,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
    },
    // Pager
    pager: {
        flex: 1,
    },
    dayPage: {
        flex: 1,
    },
    dayPageContent: {
        paddingHorizontal: 12,
        paddingBottom: 24,
    },
    // Slot row
    slotRow: {
        flexDirection: 'row',
        minHeight: SLOT_HEIGHT,
        marginBottom: 4,
    },
    timeLabel: {
        width: 52,
        paddingTop: 12,
        paddingRight: 8,
        alignItems: 'flex-end',
    },
    timeLabelText: {
        fontSize: 13,
        fontFamily: fonts.monoMedium,
        color: palette.textSecondary,
    },
    timeLabelEnd: {
        fontSize: 11,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
        marginTop: 2,
    },
    slotContent: {
        flex: 1,
        position: 'relative',
        minHeight: SLOT_HEIGHT,
    },
    // Time indicator
    timeIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: palette.danger,
        zIndex: 10,
    },
    // Class card — neutral surface, subject colour lives on the top bar
    classCard: {
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderDefault,
        backgroundColor: palette.bgElevated,
        marginBottom: 4,
        minHeight: SLOT_HEIGHT - 8,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    classCardBar: {
        flexDirection: 'row',
        height: 3,
    },
    classCardBarHalf: {
        flex: 1,
    },
    classCardContent: {
        padding: 12,
    },
    className: {
        fontSize: 15,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginBottom: 4,
    },
    classTeacher: {
        fontSize: 13,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        marginBottom: 4,
    },
    classRoomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    classRoom: {
        fontSize: 12,
        fontFamily: fonts.monoMedium,
        color: palette.textPrimary,
    },
    weekBadge: {
        fontSize: 11,
        fontFamily: fonts.monoMedium,
        color: palette.textSecondary,
        backgroundColor: palette.bgInset,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.xs,
        overflow: 'hidden',
    },
    // Empty slot
    emptySlot: {
        minHeight: SLOT_HEIGHT - 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        borderStyle: 'dashed',
    },
    emptySlotText: {
        fontSize: 16,
        color: palette.textTertiary,
    },
    // Empty state (no class selected)
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 24,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        textAlign: 'center',
    },
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: no errors referencing `timetable.tsx`.

- [ ] **Step 5: Grep-verify no old palette leftovers**

Run: `grep -n "#12121a\|#6366f1\|#818cf8\|#ef4444\|rgba(255, 255, 255" "packages/mobile/app/(tabs)/timetable.tsx"`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add "packages/mobile/app/(tabs)/timetable.tsx"
git commit -m "feat(mobile): restyle timetable screen to Blueprint v4 — subject colour moves to card top bar"
```

---

### Task 5: Planner screen restyle

**Files:**
- Modify: `packages/mobile/app/(tabs)/planner.tsx`

**Interfaces:**
- Consumes: `palette`, `radius`, `fonts` from Task 2.
- Produces: nothing new — leaf UI.

- [ ] **Step 1: Add the theme import**

After the existing imports, add:
```tsx
import { palette, radius, fonts } from '@/constants/theme';
```

- [ ] **Step 2: Update the `ActivityIndicator` color**

Replace `<ActivityIndicator size="large" color="#818cf8" />` with
`<ActivityIndicator size="large" color={palette.accent} />`.

- [ ] **Step 3: Replace the grid cell JSX with the bar-on-top treatment**

Replace the `<TouchableOpacity ... >{selected ? (...) : hasOptions ? (...) : null}</TouchableOpacity>` block (the cell renderer inside the `COMBINED_SLOTS.map` → `DAYS.map` loop) with:

```tsx
                            return (
                                <TouchableOpacity
                                    key={dayIndex}
                                    style={[
                                        styles.cell,
                                        selected && styles.cellSelected,
                                        !selected && hasOptions && styles.cellAvailable,
                                    ]}
                                    onPress={() => handleSlotPress(dayIndex, slotIndex)}
                                    disabled={!hasOptions}
                                    activeOpacity={0.7}
                                >
                                    {selected && (
                                        <View style={[styles.cellBar, { backgroundColor: selected.color || palette.accent }]} />
                                    )}
                                    {selected ? (
                                        <>
                                            <Text style={styles.cellText} numberOfLines={2}>
                                                {selected.subject_name}
                                            </Text>
                                            <Text style={styles.cellSub} numberOfLines={1}>
                                                {selected.classroom || ''}
                                            </Text>
                                        </>
                                    ) : hasOptions ? (
                                        <Text style={styles.cellPlus}>+</Text>
                                    ) : null}
                                </TouchableOpacity>
                            );
```

- [ ] **Step 4: Update the option-card JSX in the modal**

Replace:
```tsx
                                                style={[
                                                    styles.optionCard,
                                                    isSelected && styles.optionCardActive,
                                                    { borderLeftColor: entry.color || '#818cf8' },
                                                ]}
```
with:
```tsx
                                                style={[
                                                    styles.optionCard,
                                                    isSelected && styles.optionCardActive,
                                                    { borderLeftColor: entry.color || palette.accent },
                                                ]}
```

- [ ] **Step 5: Replace the full `styles` block**

```tsx
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.bgApp,
    },
    title: {
        fontSize: 28,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 8,
        paddingBottom: 24,
    },
    // Grid
    gridRow: {
        flexDirection: 'row',
        marginBottom: 3,
    },
    timeCol: {
        width: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 11,
        fontFamily: fonts.monoMedium,
        color: palette.textTertiary,
    },
    dayHeader: {
        flex: 1,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayHeaderText: {
        fontSize: 13,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
    },
    cell: {
        flex: 1,
        height: CELL_SIZE,
        backgroundColor: palette.bgSurface,
        borderRadius: radius.sm,
        marginHorizontal: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 3,
        borderWidth: 1,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    cellSelected: {
        backgroundColor: palette.bgElevated,
        borderColor: palette.borderDefault,
    },
    cellAvailable: {
        borderColor: palette.borderSubtle,
        borderStyle: 'dashed',
    },
    cellBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    cellText: {
        fontSize: 9,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        textAlign: 'center',
    },
    cellSub: {
        fontSize: 8,
        fontFamily: fonts.mono,
        color: palette.textSecondary,
        textAlign: 'center',
        marginTop: 1,
    },
    cellPlus: {
        fontSize: 18,
        color: palette.textTertiary,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: palette.bgElevated,
        borderTopLeftRadius: radius.md,
        borderTopRightRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderDefault,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '70%',
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: palette.borderStrong,
        borderRadius: radius.pill,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        marginBottom: 16,
    },
    modalScroll: {
        maxHeight: 400,
    },
    optionCard: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        padding: 14,
        marginBottom: 8,
        borderLeftWidth: 3,
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionCardActive: {
        backgroundColor: palette.accentSubtle,
        borderColor: palette.accentLine,
    },
    optionName: {
        fontSize: 15,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginBottom: 3,
    },
    optionTeacher: {
        fontSize: 13,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        marginBottom: 4,
    },
    optionMeta: {
        flexDirection: 'row',
        gap: 8,
    },
    optionRoom: {
        fontSize: 12,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
    },
    optionGroup: {
        fontSize: 11,
        fontFamily: fonts.monoMedium,
        color: palette.accent,
    },
    checkmark: {
        fontSize: 20,
        color: palette.accent,
        fontFamily: fonts.sansBold,
        marginLeft: 8,
    },
    clearButton: {
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    clearButtonText: {
        fontSize: 15,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
    },
    // Empty state
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 24,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        textAlign: 'center',
    },
});
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: no errors referencing `planner.tsx`.

- [ ] **Step 7: Grep-verify no old palette leftovers**

Run: `grep -n "#12121a\|#1a1a24\|#6366f1\|#818cf8\|rgba(255, 255, 255\|rgba(129, 140, 248" "packages/mobile/app/(tabs)/planner.tsx"`
Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add "packages/mobile/app/(tabs)/planner.tsx"
git commit -m "feat(mobile): restyle planner screen to Blueprint v4"
```

---

### Task 6: Settings screen restyle

**Files:**
- Modify: `packages/mobile/app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `palette`, `fonts` from Task 2.
- Produces: nothing new — leaf UI.

- [ ] **Step 1: Add the theme import**

After the existing imports, add:
```tsx
import { palette, radius, fonts } from '@/constants/theme';
```

- [ ] **Step 2: Update the `ActivityIndicator` color**

Replace `<ActivityIndicator size="small" color="#818cf8" style={{ padding: 24 }} />`
with `<ActivityIndicator size="small" color={palette.accent} style={{ padding: 24 }} />`.

- [ ] **Step 3: Replace the full `styles` block**

Selected option chips (faculty/year/group) get a 2px leading-edge accent rail
per `DESIGN_SYSTEM.md` §4's "Settings dropdown (selected) → 2px accent rail,
leading edge" rule, instead of the old filled-indigo active state.

```tsx
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.bgApp,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        marginBottom: 24,
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: fonts.sansBold,
        color: palette.textTertiary,
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    card: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    cardLabel: {
        fontSize: 14,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
    },
    cardValue: {
        fontSize: 17,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginTop: 4,
    },
    cardArrow: {
        fontSize: 16,
        color: palette.textTertiary,
    },
    // Picker
    pickerContainer: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        padding: 16,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    pickerLabel: {
        fontSize: 13,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
        marginBottom: 10,
        marginTop: 16,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    optionChip: {
        backgroundColor: palette.bgElevated,
        borderRadius: radius.sm,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: palette.borderDefault,
        borderLeftWidth: 1,
    },
    optionChipActive: {
        borderLeftWidth: 2,
        borderLeftColor: palette.accent,
    },
    optionText: {
        fontSize: 14,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
    },
    optionTextActive: {
        color: palette.accent,
        fontFamily: fonts.sansSemiBold,
    },
    yearChip: {
        flex: 1,
        backgroundColor: palette.bgElevated,
        borderRadius: radius.sm,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
        borderLeftWidth: 1,
    },
    yearText: {
        fontSize: 16,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
    },
    groupChip: {
        flex: 1,
        backgroundColor: palette.bgElevated,
        borderRadius: radius.sm,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
        borderLeftWidth: 1,
    },
    groupText: {
        fontSize: 20,
        fontFamily: fonts.sansBold,
        color: palette.textSecondary,
    },
    // About
    aboutCard: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    aboutTitle: {
        fontSize: 20,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        marginBottom: 4,
    },
    aboutVersion: {
        fontSize: 14,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
        marginBottom: 12,
    },
    aboutDescription: {
        fontSize: 14,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
```

Note: `optionChipActive`/`yearChip`+`selectedYear === y && styles.optionChipActive`/
`groupChip`+`selectedGroup === g && styles.optionChipActive` in the component
body already apply `optionChipActive` conditionally — no JSX changes needed
here, only the style values above.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: no errors referencing `settings.tsx`.

- [ ] **Step 5: Grep-verify no old palette leftovers**

Run: `grep -n "#12121a\|#6366f1\|#818cf8\|rgba(255, 255, 255\|rgba(129, 140, 248" "packages/mobile/app/(tabs)/settings.tsx"`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add "packages/mobile/app/(tabs)/settings.tsx"
git commit -m "feat(mobile): restyle settings screen to Blueprint v4"
```

---

### Task 7: Onboarding restyle + dead-import cleanup

**Files:**
- Modify: `packages/mobile/app/onboarding.tsx`
- Delete: `packages/mobile/constants/Colors.ts` (only remaining consumer is
  this file; removed in this task's Step 1)

**Interfaces:**
- Consumes: `palette`, `radius`, `fonts` from Task 2.
- Produces: nothing new — leaf UI.

- [ ] **Step 1: Remove dead imports and the `Colors`/`isDark` usage**

Two unrelated pieces of dead code live in this file's imports, found while
reading it for this task — fix both while here:
1. `import { useTranslation } from 'react-i18next';` — `react-i18next` is not
   a dependency of `packages/mobile` (it was pruned from the web app; mobile
   never had it either) and the destructured `t` is never called anywhere in
   the file. This import would fail to resolve at build time.
2. `import Colors from '@/constants/Colors';` plus `const isDark = ... ; const
   colors = isDark ? Colors.dark : Colors.light;` — `colors` is never read
   anywhere in the file body (dead variable). `Colors.ts` is an unused
   leftover from the Expo default template.

Replace the import block:
```tsx
import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAppStore } from '@/stores/appStore';
import { palette, radius, fonts } from '@/constants/theme';
import { AnimatedStep } from '../components/AnimatedStep';
import {
    fetchClasses,
    getUniqueFaculties,
    getYearsForFaculty,
    getGroupsForFacultyYear,
    findClass,
    ClassData,
} from '@unitimetable/shared';
```

Remove the two now-dead lines inside the component body:
```tsx
    const { t } = useTranslation();
```
and
```tsx
    const isDark = preferences.theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;
```
`preferences` (destructured from `useAppStore()`) was only ever read by the
`isDark` line just removed — it is not used anywhere else in this file, so
drop it from the destructure too:
```tsx
    const { setSelectedClass, setFirstLaunchComplete } = useAppStore();
```

- [ ] **Step 2: Update the `ActivityIndicator` color**

Replace `<ActivityIndicator size="large" color="#818cf8" />` with
`<ActivityIndicator size="large" color={palette.accent} />`.

- [ ] **Step 3: Replace the three `LinearGradient` card blocks with flat panels**

Blueprint v4 retired indigo/violet/pink gradients entirely (`DESIGN_SYSTEM.md`
§6). Replace each selectable "card" with a flat `bgElevated` panel and a 2px
leading-edge accent rail when selected (same convention as Settings' option
chips in Task 6), dropping `expo-linear-gradient` from this file.

Faculty card (Step 1 grid) — replace:
```tsx
                                <LinearGradient
                                    colors={selectedFaculty === faculty ? ['#6366f1', '#4f46e5'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                                    style={styles.cardGradient}
                                >
                                    <Text style={[
                                        styles.cardText,
                                        selectedFaculty === faculty && styles.cardTextSelected
                                    ]}>{faculty}</Text>
                                </LinearGradient>
```
with:
```tsx
                                <View style={styles.cardInner}>
                                    <Text style={[
                                        styles.cardText,
                                        selectedFaculty === faculty && styles.cardTextSelected
                                    ]}>{faculty}</Text>
                                </View>
```

Year card (Step 2 row) — replace:
```tsx
                                        <LinearGradient
                                            colors={selectedYear === year ? ['#8b5cf6', '#7c3aed'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                                            style={styles.cardGradient}
                                        >
                                            <Text style={[
                                                styles.yearText,
                                                selectedYear === year && styles.cardTextSelected
                                            ]}>{year}.</Text>
                                            <Text style={[
                                                styles.yearLabel,
                                                selectedYear === year && styles.cardTextSelected
                                            ]}>évfolyam</Text>
                                        </LinearGradient>
```
with:
```tsx
                                        <View style={styles.cardInner}>
                                            <Text style={[
                                                styles.yearText,
                                                selectedYear === year && styles.cardTextSelected
                                            ]}>{year}.</Text>
                                            <Text style={[
                                                styles.yearLabel,
                                                selectedYear === year && styles.cardTextSelected
                                            ]}>évfolyam</Text>
                                        </View>
```

Group card (Step 3 grid) — replace:
```tsx
                                        <LinearGradient
                                            colors={selectedGroup === group ? ['#ec4899', '#db2777'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                                            style={styles.cardGradient}
                                        >
                                            <Text style={[
                                                styles.groupText,
                                                selectedGroup === group && styles.cardTextSelected
                                            ]}>{group}</Text>
                                        </LinearGradient>
```
with:
```tsx
                                        <View style={styles.cardInner}>
                                            <Text style={[
                                                styles.groupText,
                                                selectedGroup === group && styles.cardTextSelected
                                            ]}>{group}</Text>
                                        </View>
```

- [ ] **Step 4: Replace the full `styles` block**

```tsx
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.bgApp,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: palette.bgApp,
    },
    loadingText: {
        color: palette.textSecondary,
        marginTop: 16,
        fontSize: 16,
        fontFamily: fonts.sans,
    },
    errorEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorText: {
        color: palette.danger,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 32,
        fontFamily: fonts.sans,
    },
    retryButton: {
        backgroundColor: palette.accent,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: radius.md,
    },
    retryButtonText: {
        color: palette.bgApp,
        fontFamily: fonts.sansSemiBold,
        fontSize: 16,
    },
    scrollContent: {
        padding: 24,
        paddingTop: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        textAlign: 'center',
    },
    sectionContainer: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontFamily: fonts.sansSemiBold,
        color: palette.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    card: {
        width: '48%',
        aspectRatio: 1.5,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    yearCard: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    cardInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: palette.bgElevated,
    },
    cardSelected: {
        borderColor: palette.accent,
        borderLeftWidth: 2,
    },
    cardText: {
        fontSize: 16,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
        textAlign: 'center',
    },
    yearText: {
        fontSize: 32,
        fontFamily: fonts.sansBold,
        color: palette.textSecondary,
    },
    yearLabel: {
        fontSize: 12,
        fontFamily: fonts.sans,
        color: palette.textTertiary,
        marginTop: 4,
    },
    groupText: {
        fontSize: 20,
        fontFamily: fonts.sansBold,
        color: palette.textSecondary,
    },
    cardTextSelected: {
        color: palette.accent,
    },
});
```

Note: `cardGradient` style is removed (no longer used, replaced by `cardInner`).
`cardSelected` drops its `transform: [{ scale: 1.02 }]` — Blueprint v4 has no
"lift" micro-interaction convention for selection state; the rail communicates
it instead.

- [ ] **Step 5: Delete the now-unused `Colors.ts`**

```bash
rm packages/mobile/constants/Colors.ts
```

- [ ] **Step 6: Verify `expo-linear-gradient` has no other consumers before considering removal**

Run: `grep -rln "expo-linear-gradient" packages/mobile --include=*.tsx --include=*.ts | grep -v node_modules`
If the only remaining match is in `package.json`'s dependency list (no `.tsx`/`.ts`
source file imports it anymore), remove it from `packages/mobile/package.json`
dependencies and run `pnpm install` to update the lockfile. If any other file
still imports it, leave the dependency in place.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: no errors anywhere in `packages/mobile` (this is the last screen —
all token-name migrations from Task 2 should now be fully resolved).

- [ ] **Step 8: Grep-verify no old palette leftovers**

Run: `grep -n "#12121a\|#6366f1\|#8b5cf6\|#ec4899\|#818cf8\|#ef4444\|rgba(255,255,255" packages/mobile/app/onboarding.tsx`
Expected: no matches.

- [ ] **Step 9: Commit**

```bash
git add packages/mobile/app/onboarding.tsx packages/mobile/constants/Colors.ts packages/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): restyle onboarding to Blueprint v4, drop dead react-i18next/Colors.ts imports"
```

---

### Task 8: Widget restyle

**Files:**
- Modify: `packages/mobile/widget/WidgetUI.tsx`

**Interfaces:**
- Consumes: `UpcomingClass`, `formatTimeRange` from `./widget-data` (unchanged,
  already exists).
- Produces: nothing new — leaf UI. Note: RemoteViews (the Android widget
  renderer `react-native-android-widget` targets) cannot load custom font
  assets through this library's JSX-to-RemoteViews renderer, so the widget
  keeps the system default font — only colors, borders, and radius change.
  This mirrors the same scoped exception already called out in the design
  spec.

- [ ] **Step 1: Replace the full file**

```tsx
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { UpcomingClass } from './widget-data';
import { formatTimeRange } from './widget-data';

// Design tokens — mirror packages/mobile/constants/theme.ts (Blueprint v4).
// RemoteViews can't load custom fonts or backdrop blur, so this uses the
// system default font and opaque surfaces/hairlines instead.
const C = {
    bgElevated: '#131619',
    bgInset: '#050506',
    borderDefault: '#26292e',
    textPrimary: '#edeef0',
    textSecondary: '#969ba3',
    textTertiary: '#5f646c',
    accent: '#3fbb7d',
} as const;

const R = { sm: 2, md: 2 } as const; // Blueprint v4: radius is 2px everywhere

interface WidgetUIProps {
    items: UpcomingClass[];
    offset: number;
}

function ArrowButton({ label, action, disabled }: { label: string; action: string; disabled: boolean }) {
    return (
        <TextWidget
            text={label}
            clickAction={disabled ? undefined : action}
            style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: disabled ? C.textTertiary : C.textPrimary,
                backgroundColor: C.bgInset,
                borderRadius: R.sm,
                paddingHorizontal: 12,
                paddingVertical: 2,
            }}
        />
    );
}

export function WidgetUI({ items, offset }: WidgetUIProps) {
    const hasClasses = items && items.length > 0;
    const safeOffset = hasClasses ? Math.min(Math.max(offset, 0), items.length - 1) : 0;
    const item = hasClasses ? items[safeOffset] : null;

    return (
        <FlexWidget
            clickAction="OPEN_APP"
            style={{
                height: 'match_parent',
                width: 'match_parent',
                flexDirection: 'column',
                backgroundColor: C.bgElevated,
                borderRadius: R.md,
                padding: 10,
            }}
        >
            {/* Header: status label + position + arrows */}
            <FlexWidget
                style={{
                    flexDirection: 'row',
                    width: 'match_parent',
                    justifyContent: 'space_between',
                    alignItems: 'center',
                    marginBottom: 6,
                }}
            >
                <TextWidget
                    text={
                        !item
                            ? 'UniTimetable'
                            : item.isNow
                                ? '● MOST'
                                : `KÖVETKEZŐ • ${item.dayLabel}`
                    }
                    style={{
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: item?.isNow ? C.accent : C.textSecondary,
                        letterSpacing: 0.5,
                    }}
                />

                {hasClasses && (
                    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TextWidget
                            text={`${safeOffset + 1}/${items.length}`}
                            style={{ fontSize: 11, color: C.textSecondary, marginRight: 8 }}
                        />
                        <ArrowButton label="‹" action="PREV_CLASS" disabled={safeOffset === 0} />
                        <FlexWidget style={{ width: 6, height: 1 }} />
                        <ArrowButton label="›" action="NEXT_CLASS" disabled={safeOffset >= items.length - 1} />
                    </FlexWidget>
                )}
            </FlexWidget>

            {/* Class card — neutral surface + subject-colour top bar (colour never fills a card in Blueprint v4) */}
            {item ? (
                <FlexWidget
                    clickAction="OPEN_APP"
                    style={{
                        flex: 1,
                        width: 'match_parent',
                        flexDirection: 'column',
                        backgroundColor: C.bgInset,
                        borderRadius: R.sm,
                        borderColor: C.borderDefault,
                        borderWidth: 1,
                    }}
                >
                    <FlexWidget
                        style={{
                            width: 'match_parent',
                            height: 3,
                            backgroundColor: item.color as `#${string}`,
                        }}
                    />
                    <FlexWidget
                        style={{
                            flex: 1,
                            width: 'match_parent',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                        }}
                    >
                        <TextWidget
                            text={item.entry.subject_name || 'Ismeretlen tárgy'}
                            maxLines={2}
                            style={{ fontSize: 15, fontWeight: 'bold', color: C.textPrimary }}
                        />
                        {!!item.entry.teacher_name && (
                            <TextWidget
                                text={item.entry.teacher_name}
                                maxLines={1}
                                style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}
                            />
                        )}
                        <FlexWidget
                            style={{
                                flexDirection: 'row',
                                width: 'match_parent',
                                justifyContent: 'space_between',
                                marginTop: 6,
                            }}
                        >
                            <TextWidget
                                text={`📍 ${item.entry.classroom || '—'}`}
                                style={{ fontSize: 12, fontWeight: '500', color: C.textPrimary }}
                            />
                            <TextWidget
                                text={`${formatTimeRange(item)}${item.entry.week_type !== 'all' ? (item.entry.week_type === 'odd' ? '  •  1. hét' : '  •  2. hét') : ''}`}
                                style={{ fontSize: 12, fontWeight: '500', color: C.textPrimary }}
                            />
                        </FlexWidget>
                    </FlexWidget>
                </FlexWidget>
            ) : (
                <FlexWidget
                    clickAction="OPEN_APP"
                    style={{
                        flex: 1,
                        width: 'match_parent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: C.bgInset,
                        borderRadius: R.sm,
                        borderColor: C.borderDefault,
                        borderWidth: 1,
                    }}
                >
                    <TextWidget
                        text="Nincs több óra 🎉"
                        style={{ fontSize: 14, fontWeight: 'bold', color: C.textPrimary }}
                    />
                    <TextWidget
                        text="Nyisd meg az appot a frissítéshez"
                        style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}
                    />
                </FlexWidget>
            )}
        </FlexWidget>
    );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: no errors referencing `widget/WidgetUI.tsx`.

- [ ] **Step 3: If `react-native-android-widget` rejects `borderWidth`/`borderColor` on `FlexWidget`**

This library maps a JSX-like style API onto Android `RemoteViews`, and its
supported style-prop set has changed across versions. If a build/prebuild
error or runtime warning indicates `borderWidth`/`borderColor` aren't
supported on `FlexWidget` in the installed `react-native-android-widget@^0.20.1`,
fall back to `borderRadius` + `backgroundColor` only (drop the two border
lines) — the top color bar still carries the "state lives on an edge" signal
even without the surrounding hairline.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/widget/WidgetUI.tsx
git commit -m "feat(mobile): restyle Android widget to Blueprint v4 — subject colour on a top bar, not the fill"
```

---

### Task 9: iOS EAS build config

**Files:**
- Create: `packages/mobile/eas.json`

**Interfaces:** None — standalone config file, no code dependents.

- [ ] **Step 1: Create `packages/mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 2: Sanity-check the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/mobile/eas.json', 'utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/eas.json
git commit -m "chore(mobile): add EAS build profiles for cloud iOS/Android builds"
```

(No `eas build` invocation happens in this task — that requires the user to
run `eas login` interactively, which is called out in the final report, not
performed here.)

---

### Task 10: Full verification pass

**Files:** None modified — this task only verifies Tasks 1-9 together.

**Interfaces:** None.

- [ ] **Step 1: Full typecheck**

Run: `pnpm --filter @unitimetable/mobile typecheck`
Expected: exits 0, no errors.

- [ ] **Step 2: Full-package grep sweep for old-palette leftovers**

Run:
```bash
grep -rn "#12121a\|#181824\|#1a1a24\|#222230\|#6366f1\|#818cf8\|#8b5cf6\|#a855f7\|#ec4899\|#a5b4fc\|#d8b4fe" packages/mobile/app packages/mobile/widget packages/mobile/constants packages/mobile/hooks packages/mobile/components 2>/dev/null
```
Expected: no matches. If any appear, they're either a missed spot from an
earlier task (fix and re-commit against that task) or a legitimate new
subject-color hex from `getSubjectColor()`/`item.color` (dynamic, not a
literal in source — those are fine and won't show up in a source grep anyway).

- [ ] **Step 3: Confirm workspace root is clean of the deleted packages**

Run: `pnpm -r list --depth -1 2>&1 | grep -i widget-app`
Expected: no output (package no longer exists in the workspace).

- [ ] **Step 4: Update `MOBILE_GUIDE.md`'s known-limitations note**

The line `- ~~Subject colors assigned in encounter order~~` etc. in
`MOBILE_GUIDE.md` documents pre-restyle state. Add one line to its "Known
limitations / next steps" list:
```markdown
- **Visual restyle to Blueprint v4 done** (2026-08-07): tokens, fonts, and the
  subject-colour-on-a-bar card treatment now match web across all screens and
  the widget. Feature parity (PlannerWizard, ClassDetailModal, subject import,
  toasts) is still open — see `docs/superpowers/specs/2026-08-07-mobile-blueprint-v4-restyle-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add MOBILE_GUIDE.md
git commit -m "docs: note Blueprint v4 mobile restyle completion in MOBILE_GUIDE"
```

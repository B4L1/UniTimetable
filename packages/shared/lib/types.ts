export interface ClassData {
    id: string;
    name: string;
    faculty: string | null;
    year: number;
    group_code: string | null;
    edupage_id: string | null;
    created_at: string;
}

export interface Teacher {
    id: string;
    name: string;
    edupage_id: string | null;
    created_at: string;
}

export type EventType = 'lecture' | 'lab' | 'seminar' | 'other';

/** Provenance of an event's week parity — see SPEC_V3_PLAN.md B7a. */
export type WeekTypeSource =
    | 'scraped'
    | 'derived-teacher'
    | 'derived-room'
    | 'derived-groupswap'
    | 'manual'
    | 'ambiguous';

export interface TimetableEntry {
    id: string;
    class_id: string;
    subject_name: string;
    teacher_code: string | null;
    teacher_name: string | null;
    classroom: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
    week_type: 'all' | 'odd' | 'even';
    color: string | null;
    teacher_id?: string | null;
    class_names?: string | null;
    scraped_at: string;
    // v3 fields — present only when the row came from the `events` table via
    // the dual-read adapter in api.ts; absent while reads hit timetable_entries
    course_id?: string;
    event_type?: EventType;
    week_type_source?: WeekTypeSource;
    source_hash?: string | null;
}

/** v3 `courses` row — one per base subject (suffix-stripped, see colors.ts). */
export interface Course {
    id: string;
    name: string;
    norm_name: string;
    created_at?: string;
}

/**
 * Color theme — a pure CSS token map, synced across devices.
 * 'light'      Sapientia (default)
 * 'dark'       basic dark, solid surfaces
 * 'dark-glass' dark with frosted/translucent surfaces
 * 'terminal'   easter-egg theme (unlockable)
 * Seasonal themes (christmas, easter, …) slot in here later as token-only additions.
 */
export type ColorTheme = 'light' | 'dark' | 'dark-glass' | 'terminal';

/**
 * Animated background effect — independent of the color theme,
 * device-local (never synced), lazy-loaded, off by default.
 */
export type BackgroundEffect =
    | 'none'
    | 'aurora'
    | 'pixel-blast'
    | 'iridescence'
    | 'liquid-chrome'
    | 'faulty-terminal';

/** @deprecated pre-v3 combined theme+background value; kept only so stored
 *  preferences from older clients can be migrated. */
export type BackgroundTheme =
    | 'none'
    | 'silk'
    | 'aurora'
    | 'pixel-blast'
    | 'beams'
    | 'dither'
    | 'faulty-terminal'
    | 'iridescence'
    | 'liquid-chrome'
    | 'sapientia';

export interface Preferences {
    theme: 'dark' | 'light';
    language: 'hu' | 'en';
    showTimeIndicator: boolean;
    colorTheme: ColorTheme;
    /** @deprecated see BackgroundTheme; read once for migration, never written */
    backgroundTheme?: BackgroundTheme;
    invertWeekParity?: boolean;
}

// Alias for backward compatibility
export type UserPreferences = Preferences;

export const DEFAULT_PREFERENCES: Preferences = {
    theme: 'light',
    language: 'hu',
    showTimeIndicator: true,
    colorTheme: 'light',
    invertWeekParity: false,
};

/** Derive the v3 colorTheme from possibly-old stored preferences. */
export function migrateColorTheme(stored: Partial<Preferences> | null): ColorTheme {
    if (stored?.colorTheme) return stored.colorTheme;
    const bg = stored?.backgroundTheme;
    if (!bg || bg === 'sapientia') return 'light';
    if (bg === 'faulty-terminal') return 'terminal';
    return 'dark';
}

/** Derive the initial device-local background effect from old stored preferences. */
export function migrateBackgroundEffect(stored: Partial<Preferences> | null): BackgroundEffect {
    const bg = stored?.backgroundTheme;
    switch (bg) {
        case 'aurora':
        case 'pixel-blast':
        case 'iridescence':
        case 'liquid-chrome':
        case 'faulty-terminal':
            return bg;
        default:
            return 'none';
    }
}

export interface SelectedClass {
    id: string;
    name: string;
    faculty: string;
    year: number;
    groupCode: string;
}

// Alias for backward compatibility
export type ClassInfo = SelectedClass;

export interface IStorage {
    isFirstLaunch(): Promise<boolean>;
    setFirstLaunchComplete(): Promise<void>;
    getSelectedClass(): Promise<SelectedClass | null>;
    setSelectedClass(classInfo: SelectedClass): Promise<void>;
    getTimetableCache(): Promise<TimetableEntry[] | null>;
    setTimetableCache(entries: TimetableEntry[]): Promise<void>;
    getUserSelections(): Promise<string[]>;
    setUserSelections(ids: string[]): Promise<void>;
    getPreferences(): Promise<Preferences | null>;
    setPreferences(prefs: Preferences): Promise<void>;
}

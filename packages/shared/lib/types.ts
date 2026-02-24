export interface ClassData {
    id: string;
    name: string;
    faculty: string | null;
    year: number;
    group_code: string | null;
    edupage_id: string | null;
    created_at: string;
}

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
    scraped_at: string;
}

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
    backgroundTheme: BackgroundTheme;
    invertWeekParity?: boolean;
}

// Alias for backward compatibility
export type UserPreferences = Preferences;

export const DEFAULT_PREFERENCES: Preferences = {
    theme: 'dark',
    language: 'hu',
    showTimeIndicator: true,
    backgroundTheme: 'sapientia',
    invertWeekParity: false,
};

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

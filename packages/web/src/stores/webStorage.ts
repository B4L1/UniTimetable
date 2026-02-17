// Web storage implementation using localStorage

import type { IStorage, ClassInfo, TimetableEntry, Preferences } from '@shared/lib/types';

const KEYS = {
    FIRST_LAUNCH: 'unitimetable_first_launch',
    SELECTED_CLASS: 'unitimetable_selected_class',
    TIMETABLE_CACHE: 'unitimetable_cache',
    USER_SELECTIONS: 'unitimetable_selections',
    PREFERENCES: 'unitimetable_preferences',
    IMPORTED_SUBJECTS: 'unitimetable_imported_subjects',
    FAULTY_TERMINAL_UNLOCKED: 'unitimetable_ft_unlocked',
};

export const webStorage: IStorage & {
    reset: () => Promise<void>,
    clearClass: () => Promise<void>,
    getImportedSubjects: () => Promise<string[]>,
    setImportedSubjects: (subjects: string[]) => Promise<void>,
    getFaultyTerminalUnlocked: () => Promise<boolean>,
    setFaultyTerminalUnlocked: (unlocked: boolean) => Promise<void>
} = {
    async isFirstLaunch(): Promise<boolean> {
        const value = localStorage.getItem(KEYS.FIRST_LAUNCH);
        return value !== 'false';
    },

    async setFirstLaunchComplete(): Promise<void> {
        localStorage.setItem(KEYS.FIRST_LAUNCH, 'false');
    },

    async getSelectedClass(): Promise<ClassInfo | null> {
        const value = localStorage.getItem(KEYS.SELECTED_CLASS);
        return value ? JSON.parse(value) : null;
    },

    async setSelectedClass(classInfo: ClassInfo): Promise<void> {
        localStorage.setItem(KEYS.SELECTED_CLASS, JSON.stringify(classInfo));
    },

    async getTimetableCache(): Promise<TimetableEntry[] | null> {
        const value = localStorage.getItem(KEYS.TIMETABLE_CACHE);
        return value ? JSON.parse(value) : null;
    },

    async setTimetableCache(entries: TimetableEntry[]): Promise<void> {
        localStorage.setItem(KEYS.TIMETABLE_CACHE, JSON.stringify(entries));
    },

    async getUserSelections(): Promise<string[]> {
        const value = localStorage.getItem(KEYS.USER_SELECTIONS);
        return value ? JSON.parse(value) : [];
    },

    async setUserSelections(ids: string[]): Promise<void> {
        localStorage.setItem(KEYS.USER_SELECTIONS, JSON.stringify(ids));
    },

    async getImportedSubjects(): Promise<string[]> {
        const value = localStorage.getItem(KEYS.IMPORTED_SUBJECTS);
        return value ? JSON.parse(value) : [];
    },

    async setImportedSubjects(subjects: string[]): Promise<void> {
        localStorage.setItem(KEYS.IMPORTED_SUBJECTS, JSON.stringify(subjects));
    },

    async getPreferences(): Promise<Preferences | null> {
        const value = localStorage.getItem(KEYS.PREFERENCES);
        return value ? JSON.parse(value) : null;
    },

    async setPreferences(prefs: Preferences): Promise<void> {
        localStorage.setItem(KEYS.PREFERENCES, JSON.stringify(prefs));
    },

    async reset(): Promise<void> {
        localStorage.clear();
    },

    async clearClass(): Promise<void> {
        localStorage.removeItem(KEYS.SELECTED_CLASS);
        localStorage.removeItem(KEYS.FIRST_LAUNCH);
        localStorage.removeItem(KEYS.TIMETABLE_CACHE);
        localStorage.removeItem(KEYS.USER_SELECTIONS);
        localStorage.removeItem(KEYS.IMPORTED_SUBJECTS);
    },

    async getFaultyTerminalUnlocked(): Promise<boolean> {
        const value = localStorage.getItem(KEYS.FAULTY_TERMINAL_UNLOCKED);
        return value === 'true';
    },

    async setFaultyTerminalUnlocked(unlocked: boolean): Promise<void> {
        localStorage.setItem(KEYS.FAULTY_TERMINAL_UNLOCKED, unlocked ? 'true' : 'false');
    }
};

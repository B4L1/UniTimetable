// Web storage implementation using localStorage

import type { IStorage, ClassInfo, TimetableEntry, Preferences } from '@shared/lib/types';

const KEYS = {
    FIRST_LAUNCH: 'unitimetable_first_launch',
    SELECTED_CLASS: 'unitimetable_selected_class',
    TIMETABLE_CACHE: 'unitimetable_cache',
    SELECTED_ENTRIES_CACHE: 'unitimetable_selected_entries_cache',
    USER_SELECTIONS: 'unitimetable_selections',
    PREFERENCES: 'unitimetable_preferences',
    IMPORTED_SUBJECTS: 'unitimetable_imported_subjects',
    FAULTY_TERMINAL_UNLOCKED: 'unitimetable_ft_unlocked',
    REMOVED_SUBJECTS: 'unitimetable_removed_subjects',
    CUSTOM_ENTRIES: 'unitimetable_custom_entries',
    USER: 'unitimetable_user',
    SELECTED_TEACHER: 'unitimetable_selected_teacher',
};

export const webStorage: IStorage & {
    reset: () => Promise<void>,
    clearClass: () => Promise<void>,
    getImportedSubjects: () => Promise<string[]>,
    setImportedSubjects: (subjects: string[]) => Promise<void>,
    getFaultyTerminalUnlocked: () => Promise<boolean>,
    setFaultyTerminalUnlocked: (unlocked: boolean) => Promise<void>,
    getRemovedSubjects: () => Promise<string[]>,
    setRemovedSubjects: (subjects: string[]) => Promise<void>,
    getCustomEntries: () => Promise<Record<string, { week_type?: 'all' | 'odd' | 'even' }>>,
    setCustomEntries: (entries: Record<string, { week_type?: 'all' | 'odd' | 'even' }>) => Promise<void>,
    getUser: () => Promise<any | null>,
    setUser: (user: any) => Promise<void>,
    clearUser: () => Promise<void>,
    getSelectedTeacher: () => Promise<{ id: string, name: string } | null>,
    setSelectedTeacher: (teacher: { id: string, name: string }) => Promise<void>,
    getSelectedEntriesCache: () => Promise<any[] | null>,
    setSelectedEntriesCache: (entries: any[]) => Promise<void>
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
        // Only remove our own keys — localStorage.clear() would also wipe
        // unrelated data on this origin (e.g. the last-dark-theme preference).
        Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    },

    async clearClass(): Promise<void> {
        localStorage.removeItem(KEYS.SELECTED_CLASS);
        localStorage.removeItem(KEYS.FIRST_LAUNCH);
        localStorage.removeItem(KEYS.TIMETABLE_CACHE);
        localStorage.removeItem(KEYS.USER_SELECTIONS);
        localStorage.removeItem(KEYS.IMPORTED_SUBJECTS);
        localStorage.removeItem(KEYS.REMOVED_SUBJECTS);
        localStorage.removeItem(KEYS.CUSTOM_ENTRIES);
        localStorage.removeItem(KEYS.SELECTED_TEACHER);
    },

    async getFaultyTerminalUnlocked(): Promise<boolean> {
        const value = localStorage.getItem(KEYS.FAULTY_TERMINAL_UNLOCKED);
        return value === 'true';
    },

    async setFaultyTerminalUnlocked(unlocked: boolean): Promise<void> {
        localStorage.setItem(KEYS.FAULTY_TERMINAL_UNLOCKED, unlocked ? 'true' : 'false');
    },

    async getRemovedSubjects(): Promise<string[]> {
        const value = localStorage.getItem(KEYS.REMOVED_SUBJECTS);
        return value ? JSON.parse(value) : [];
    },

    async setRemovedSubjects(subjects: string[]): Promise<void> {
        localStorage.setItem(KEYS.REMOVED_SUBJECTS, JSON.stringify(subjects));
    },

    async getCustomEntries(): Promise<Record<string, { week_type?: 'all' | 'odd' | 'even' }>> {
        const value = localStorage.getItem(KEYS.CUSTOM_ENTRIES);
        return value ? JSON.parse(value) : {};
    },

    async setCustomEntries(entries: Record<string, { week_type?: 'all' | 'odd' | 'even' }>): Promise<void> {
        localStorage.setItem(KEYS.CUSTOM_ENTRIES, JSON.stringify(entries));
    },

    async getUser(): Promise<any | null> {
        const value = localStorage.getItem(KEYS.USER);
        return value ? JSON.parse(value) : null;
    },

    async setUser(user: any): Promise<void> {
        localStorage.setItem(KEYS.USER, JSON.stringify(user));
    },

    async clearUser(): Promise<void> {
        localStorage.removeItem(KEYS.USER);
    },

    async getSelectedTeacher(): Promise<{ id: string, name: string } | null> {
        const value = localStorage.getItem(KEYS.SELECTED_TEACHER);
        return value ? JSON.parse(value) : null;
    },

    async setSelectedTeacher(teacher: { id: string, name: string }): Promise<void> {
        localStorage.setItem(KEYS.SELECTED_TEACHER, JSON.stringify(teacher));
    },

    async getSelectedEntriesCache(): Promise<any[] | null> {
        const value = localStorage.getItem(KEYS.SELECTED_ENTRIES_CACHE);
        return value ? JSON.parse(value) : null;
    },

    async setSelectedEntriesCache(entries: any[]): Promise<void> {
        localStorage.setItem(KEYS.SELECTED_ENTRIES_CACHE, JSON.stringify(entries));
    }
};

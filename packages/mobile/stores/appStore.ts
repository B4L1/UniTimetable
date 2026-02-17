// Zustand store for app state management

import { create } from 'zustand';
import {
    storage,
    UserPreferences,
    SelectedClass,
    TimetableEntry,
    ClassInfo,
    Preferences,
    DEFAULT_PREFERENCES
} from '@unitimetable/shared';

// Re-export types for convenience if needed, but better to use from shared
export type { TimetableEntry, ClassInfo, Preferences };

interface AppState {
    // First launch
    isFirstLaunch: boolean;
    setFirstLaunchComplete: () => Promise<void>;

    // Selected class
    selectedClass: ClassInfo | null;
    setSelectedClass: (classInfo: ClassInfo) => Promise<void>;

    // Timetable data
    timetableEntries: TimetableEntry[];
    setTimetableEntries: (entries: TimetableEntry[]) => void;

    // User selections (for planner)
    userSelections: string[];
    addSelection: (entryId: string) => Promise<void>;
    removeSelection: (entryId: string) => Promise<void>;
    clearSelections: () => Promise<void>;

    // Preferences
    preferences: Preferences;
    updatePreferences: (prefs: Partial<Preferences>) => Promise<void>;

    // Loading states
    isLoading: boolean;
    setLoading: (loading: boolean) => void;

    // Initialize from storage
    initialize: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    isFirstLaunch: true,
    selectedClass: null,
    timetableEntries: [],
    userSelections: [],
    preferences: DEFAULT_PREFERENCES,
    isLoading: true,

    setFirstLaunchComplete: async () => {
        await storage.setFirstLaunchComplete();
        set({ isFirstLaunch: false });
    },

    setSelectedClass: async (classInfo) => {
        await storage.setSelectedClass(classInfo);
        set({ selectedClass: classInfo });
    },

    setTimetableEntries: (entries) => {
        set({ timetableEntries: entries });
        storage.setTimetableCache(entries);
    },

    addSelection: async (entryId) => {
        const current = get().userSelections;
        if (!current.includes(entryId)) {
            const updated = [...current, entryId];
            await storage.setUserSelections(updated);
            set({ userSelections: updated });
        }
    },

    removeSelection: async (entryId) => {
        const current = get().userSelections;
        const updated = current.filter(id => id !== entryId);
        await storage.setUserSelections(updated);
        set({ userSelections: updated });
    },

    clearSelections: async () => {
        await storage.setUserSelections([]);
        set({ userSelections: [] });
    },

    updatePreferences: async (prefs) => {
        const current = get().preferences;
        const updated = { ...current, ...prefs };
        await storage.setPreferences(updated);
        set({ preferences: updated });
    },

    setLoading: (loading) => {
        set({ isLoading: loading });
    },

    initialize: async () => {
        try {
            const [isFirst, selectedClass, timetable, selections, storedPrefs] = await Promise.all([
                storage.isFirstLaunch(),
                storage.getSelectedClass(),
                storage.getTimetableCache(),
                storage.getUserSelections(),
                storage.getPreferences(),
            ]);

            // Merge stored preferences with defaults (to handle missing fields)
            const preferences: Preferences = storedPrefs
                ? { ...DEFAULT_PREFERENCES, ...storedPrefs }
                : DEFAULT_PREFERENCES;

            set({
                isFirstLaunch: isFirst,
                selectedClass: selectedClass || null,
                timetableEntries: timetable || [],
                userSelections: selections || [],
                preferences,
                isLoading: false,
            });
        } catch (error) {
            console.error('Failed to initialize app state:', error);
            set({
                isLoading: false,
                preferences: DEFAULT_PREFERENCES,
            });
        }
    },
}));

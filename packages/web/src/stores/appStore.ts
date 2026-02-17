// Zustand store for web app

import { create } from 'zustand';
import { webStorage } from './webStorage';
import type { ClassInfo, TimetableEntry, Preferences, BackgroundTheme } from '@shared/lib/types';
import { DEFAULT_PREFERENCES } from '@shared/lib/types';

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
    setSelections: (entryIds: string[]) => Promise<void>;
    clearSelections: () => Promise<void>;

    // Preferences
    preferences: Preferences;
    updatePreferences: (prefs: Partial<Preferences>) => Promise<void>;

    // Loading states
    isLoading: boolean;
    setLoading: (loading: boolean) => void;

    // Initialize from storage
    initialize: () => Promise<void>;

    // Reset app
    resetApp: () => Promise<void>;
    resetClassSelection: () => Promise<void>;

    // Imported Subjects
    importedSubjects: string[];
    addImportedSubject: (subject: string) => Promise<void>;
    removeImportedSubject: (subject: string) => Promise<void>;
    setImportedSubjects: (subjects: string[]) => Promise<void>;

    // Extras
    isFaultyTerminalUnlocked: boolean;
    setFaultyTerminalUnlocked: (unlocked: boolean) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    isFirstLaunch: true,
    selectedClass: null,
    timetableEntries: [],
    userSelections: [],
    preferences: DEFAULT_PREFERENCES,
    isLoading: true,
    importedSubjects: [], // Init

    setFirstLaunchComplete: async () => {
        await webStorage.setFirstLaunchComplete();
        set({ isFirstLaunch: false });
    },

    setSelectedClass: async (classInfo) => {
        await webStorage.setSelectedClass(classInfo);
        set({ selectedClass: classInfo });
    },

    setTimetableEntries: (entries) => {
        set({ timetableEntries: entries });
        webStorage.setTimetableCache(entries);
    },

    addSelection: async (entryId) => {
        const current = get().userSelections;
        if (!current.includes(entryId)) {
            const updated = [...current, entryId];
            await webStorage.setUserSelections(updated);
            set({ userSelections: updated });
        }
    },

    removeSelection: async (entryId) => {
        const current = get().userSelections;
        const updated = current.filter(id => id !== entryId);
        await webStorage.setUserSelections(updated);
        set({ userSelections: updated });
    },

    setSelections: async (entryIds: string[]) => {
        await webStorage.setUserSelections(entryIds);
        set({ userSelections: entryIds });
    },

    clearSelections: async () => {
        await webStorage.setUserSelections([]);
        set({ userSelections: [] });
    },

    // Imported Subjects Implementation
    addImportedSubject: async (subject) => {
        const current = get().importedSubjects;
        if (!current.includes(subject)) {
            const updated = [...current, subject];
            await webStorage.setImportedSubjects(updated);
            set({ importedSubjects: updated });
        }
    },

    removeImportedSubject: async (subject) => {
        const current = get().importedSubjects;
        const updated = current.filter(s => s !== subject);
        await webStorage.setImportedSubjects(updated);
        set({ importedSubjects: updated });
    },

    setImportedSubjects: async (subjects) => {
        await webStorage.setImportedSubjects(subjects);
        set({ importedSubjects: subjects });
    },

    isFaultyTerminalUnlocked: false, // Init
    setFaultyTerminalUnlocked: async (unlocked) => {
        await webStorage.setFaultyTerminalUnlocked(unlocked);
        set({ isFaultyTerminalUnlocked: unlocked });
    },

    updatePreferences: async (prefs) => {
        const current = get().preferences;
        const updated = { ...current, ...prefs };
        await webStorage.setPreferences(updated);
        set({ preferences: updated });
    },

    setLoading: (loading) => {
        set({ isLoading: loading });
    },

    initialize: async () => {
        try {
            const [isFirst, selectedClass, timetable, selections, storedPrefs, importedSubjects, faultyUnlocked] = await Promise.all([
                webStorage.isFirstLaunch(),
                webStorage.getSelectedClass(),
                webStorage.getTimetableCache(),
                webStorage.getUserSelections(),
                webStorage.getPreferences(),
                webStorage.getImportedSubjects(),
                webStorage.getFaultyTerminalUnlocked(),
            ]);

            // Merge stored preferences with defaults
            const preferences: Preferences = storedPrefs
                ? { ...DEFAULT_PREFERENCES, ...storedPrefs }
                : DEFAULT_PREFERENCES;

            set({
                isFirstLaunch: isFirst,
                selectedClass: selectedClass,
                timetableEntries: timetable || [],
                userSelections: selections || [],
                preferences,
                importedSubjects: importedSubjects || [],
                isFaultyTerminalUnlocked: faultyUnlocked || false,
                isLoading: false,
            });
        } catch (error) {
            console.error('Failed to initialize app state:', error);
            set({
                isLoading: false,
                preferences: DEFAULT_PREFERENCES,
                importedSubjects: [],
            });
        }
    },

    resetApp: async () => {
        await webStorage.reset();
        set({
            isFirstLaunch: true,
            selectedClass: null,
            timetableEntries: [],
            userSelections: [],
            preferences: DEFAULT_PREFERENCES,
            importedSubjects: [],
        });
    },

    resetClassSelection: async () => {
        await webStorage.clearClass();
        set({
            isFirstLaunch: true,
            selectedClass: null,
            timetableEntries: [],
            userSelections: [],
            importedSubjects: [], // Also clear imported subjects as they might be irrelevant for a new class? Or should we keep them? User said "reset class selection". Usually resetting class implies reset context. Let's clear.
        });
    },
}));

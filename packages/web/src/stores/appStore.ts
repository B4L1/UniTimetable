// Zustand store for web app

import { create } from 'zustand';
import { webStorage } from './webStorage';
import type { ClassInfo, TimetableEntry, Preferences, BackgroundTheme } from '@shared/lib/types';
import { DEFAULT_PREFERENCES } from '@shared/lib/types';
import { 
    fetchUserPreferences, 
    upsertUserPreferences, 
    fetchUserSelections, 
    updateUserSelections 
} from '@shared/index';

interface AppState {
    // First launch
    isFirstLaunch: boolean;
    setFirstLaunchComplete: () => Promise<void>;

    // Selected class/teacher
    selectedClass: ClassInfo | null;
    setSelectedClass: (classInfo: ClassInfo) => Promise<void>;
    selectedTeacher: { id: string, name: string } | null;
    setSelectedTeacher: (teacher: { id: string, name: string }) => Promise<void>;

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

    // Removed subjects (by subject name)
    removedSubjects: string[];
    addRemovedSubject: (subject: string) => Promise<void>;
    removeRemovedSubject: (subject: string) => Promise<void>;

    // Custom entry overrides (by entry ID)
    customEntries: Record<string, { week_type?: 'all' | 'odd' | 'even' }>;
    setCustomEntry: (entryId: string, overrides: { week_type?: 'all' | 'odd' | 'even' }) => Promise<void>;
    removeCustomEntry: (entryId: string) => Promise<void>;

    // User authentication
    user: {
        email: string;
        name: string;
        picture: string;
        role: 'student' | 'teacher';
        googleId: string;
        selectionId?: string;
    } | null;
    setUser: (user: any) => Promise<void>;
    logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    isFirstLaunch: true,
    selectedClass: null,
    timetableEntries: [],
    userSelections: [],
    preferences: DEFAULT_PREFERENCES,
    isLoading: true,
    importedSubjects: [], // Init
    removedSubjects: [], // Init
    customEntries: {}, // Init
    user: null, // Init
    selectedTeacher: null, // Init

    setFirstLaunchComplete: async () => {
        await webStorage.setFirstLaunchComplete();
        set({ isFirstLaunch: false });
    },

    setSelectedClass: async (classInfo) => {
        await webStorage.setSelectedClass(classInfo);
        set({ selectedClass: classInfo, selectedTeacher: null });

        const { user, preferences } = get();
        if (user) {
            await upsertUserPreferences(user.email, {
                selected_class_id: classInfo.id,
                // Include all required fields so the upsert succeeds for brand-new users
                show_time_indicator: preferences.showTimeIndicator ?? true,
                theme: (preferences.backgroundTheme === 'sapientia' ? 'light' : 'dark') as 'light' | 'dark',
                language: (preferences.language ?? 'hu') as 'hu' | 'en',
            });
        }
    },

    setSelectedTeacher: async (teacher) => {
        // @ts-ignore
        if (webStorage.setSelectedTeacher) {
            // @ts-ignore
            await webStorage.setSelectedTeacher(teacher);
        }
        set({ selectedTeacher: teacher, selectedClass: null });

        const { user, preferences } = get();
        if (user) {
            await upsertUserPreferences(user.email, {
                selected_class_id: teacher.id,
                // Include all required fields so the upsert succeeds for brand-new users
                show_time_indicator: preferences.showTimeIndicator ?? true,
                theme: (preferences.backgroundTheme === 'sapientia' ? 'light' : 'dark') as 'light' | 'dark',
                language: (preferences.language ?? 'hu') as 'hu' | 'en',
            });
        }
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
            
            const { user } = get();
            if (user) {
                await updateUserSelections(user.email, updated);
            }
        }
    },

    removeSelection: async (entryId) => {
        const current = get().userSelections;
        const updated = current.filter(id => id !== entryId);
        await webStorage.setUserSelections(updated);
        set({ userSelections: updated });
        
        const { user } = get();
        if (user) {
            await updateUserSelections(user.email, updated);
        }
    },

    setSelections: async (entryIds: string[]) => {
        await webStorage.setUserSelections(entryIds);
        set({ userSelections: entryIds });
        
        const { user } = get();
        if (user) {
            await updateUserSelections(user.email, entryIds);
        }
    },

    clearSelections: async () => {
        await webStorage.setUserSelections([]);
        set({ userSelections: [] });
        
        const { user } = get();
        if (user) {
            await updateUserSelections(user.email, []);
        }
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

    // Removed Subjects Implementation
    addRemovedSubject: async (subject) => {
        const current = get().removedSubjects;
        if (!current.includes(subject)) {
            const updated = [...current, subject];
            await webStorage.setRemovedSubjects(updated);
            set({ removedSubjects: updated });
        }
    },

    removeRemovedSubject: async (subject) => {
        const current = get().removedSubjects;
        const updated = current.filter(s => s !== subject);
        await webStorage.setRemovedSubjects(updated);
        set({ removedSubjects: updated });
    },

    // Custom Entries Implementation
    setCustomEntry: async (entryId, overrides) => {
        const current = get().customEntries;
        const updated = { ...current, [entryId]: overrides };
        await webStorage.setCustomEntries(updated);
        set({ customEntries: updated });
    },

    removeCustomEntry: async (entryId) => {
        const current = get().customEntries;
        const { [entryId]: _, ...rest } = current;
        await webStorage.setCustomEntries(rest);
        set({ customEntries: rest });
    },

    updatePreferences: async (prefs) => {
        const current = get().preferences;
        const updated = { ...current, ...prefs };
        await webStorage.setPreferences(updated);
        set({ preferences: updated });
        
        const { user } = get();
        if (user) {
            await upsertUserPreferences(user.email, {
                show_time_indicator: updated.showTimeIndicator,
                theme: updated.backgroundTheme === 'sapientia' ? 'light' : 'dark', // Map to DB schema
                // updated_at is handled in upsert function
            });
        }
    },

    setLoading: (loading) => {
        set({ isLoading: loading });
    },

    setUser: async (user) => {
        await webStorage.setUser(user);
        set({ user });
        
        // When user signs in, trigger a sync from Supabase to local state
        if (user) {
            const [remotePrefs, remoteSelections] = await Promise.all([
                fetchUserPreferences(user.email),
                fetchUserSelections(user.email)
            ]);
            
            if (remotePrefs || remoteSelections.length > 0) {
                // If remote data exists, merge it into local state and storage
                const updates: Partial<AppState> = {};
                
                if (remotePrefs) {
                    // Update user's selectionId based on remote preferences
                    if (remotePrefs.selected_class_id) {
                        user.selectionId = remotePrefs.selected_class_id;
                    }
                    
                    const updatedPrefs = {
                        ...get().preferences,
                        showTimeIndicator: remotePrefs.show_time_indicator ?? get().preferences.showTimeIndicator,
                        // Add other preferences from remotePrefs if needed
                    };
                    updates.preferences = updatedPrefs;
                    await webStorage.setPreferences(updatedPrefs);
                }
                
                if (remoteSelections.length > 0) {
                    updates.userSelections = remoteSelections;
                    await webStorage.setUserSelections(remoteSelections);
                }
                
                set(updates);
            }
        }
    },

    logout: async () => {
        await webStorage.clearUser();
        set({ user: null });
    },

    initialize: async () => {
        try {
            const [isFirst, selectedClass, selectedTeacher, timetable, selections, storedPrefs, importedSubjects, faultyUnlocked, removedSubjects, customEntries, user] = await Promise.all([
                webStorage.isFirstLaunch(),
                webStorage.getSelectedClass(),
                webStorage.getSelectedTeacher(),
                webStorage.getTimetableCache(),
                webStorage.getUserSelections(),
                webStorage.getPreferences(),
                webStorage.getImportedSubjects(),
                webStorage.getFaultyTerminalUnlocked(),
                webStorage.getRemovedSubjects(),
                webStorage.getCustomEntries(),
                webStorage.getUser(),
            ]);

            // Merge stored preferences with defaults
            const preferences: Preferences = storedPrefs
                ? { ...DEFAULT_PREFERENCES, ...storedPrefs }
                : DEFAULT_PREFERENCES;

            set({
                isFirstLaunch: isFirst,
                selectedClass: selectedClass,
                selectedTeacher: selectedTeacher,
                timetableEntries: timetable || [],
                userSelections: selections || [],
                preferences,
                importedSubjects: importedSubjects || [],
                isFaultyTerminalUnlocked: faultyUnlocked || false,
                removedSubjects: removedSubjects || [],
                customEntries: customEntries || {},
                user,
                isLoading: false,
            });
        } catch (error) {
            console.error('Failed to initialize app state:', error);
            set({
                isLoading: false,
                preferences: DEFAULT_PREFERENCES,
                importedSubjects: [],
                removedSubjects: [],
                customEntries: {},
            });
        }
    },

    resetApp: async () => {
        await webStorage.reset();
        set({
            isFirstLaunch: true,
            selectedClass: null,
            selectedTeacher: null,
            timetableEntries: [],
            userSelections: [],
            preferences: DEFAULT_PREFERENCES,
            importedSubjects: [],
            removedSubjects: [],
            customEntries: {},
            user: null,
        });
    },

    resetClassSelection: async () => {
        await webStorage.clearClass();
        set({
            isFirstLaunch: true,
            selectedClass: null,
            selectedTeacher: null,
            timetableEntries: [],
            userSelections: [],
            importedSubjects: [], // Also clear imported subjects as they might be irrelevant for a new class? Or should we keep them? User said "reset class selection". Usually resetting class implies reset context. Let's clear.
            removedSubjects: [],
            customEntries: {},
        });
    },
}));

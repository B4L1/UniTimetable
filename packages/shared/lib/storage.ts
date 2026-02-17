// Local storage utilities for offline-first data persistence
// Web-compatible version that handles both mobile and web storage

import { UserPreferences, SelectedClass } from './types';

// Storage keys
const KEYS = {
    TIMETABLE_CACHE: '@unitimetable/timetable_cache',
    PREFERENCES: '@unitimetable/preferences',
    SELECTED_CLASS: '@unitimetable/selected_class',
    FIRST_LAUNCH: '@unitimetable/first_launch',
    USER_SELECTIONS: '@unitimetable/user_selections',
};

// Re-export types for backward compatibility or convenience if needed
export type { UserPreferences, SelectedClass };

const isWebRuntime = () =>
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Get storage adapter based on platform
const getAsyncStorage = () => {
    if (isWebRuntime()) {
        // Web storage adapter using localStorage
        return {
            getItem: async (key: string): Promise<string | null> => {
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        return window.localStorage.getItem(key);
                    }
                    return null;
                } catch {
                    return null;
                }
            },
            setItem: async (key: string, value: string): Promise<void> => {
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(key, value);
                    }
                } catch {
                    // Ignore storage errors
                }
            },
            removeItem: async (key: string): Promise<void> => {
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.removeItem(key);
                    }
                } catch {
                    // Ignore storage errors
                }
            },
        };
    }
    // For native platforms, use AsyncStorage
    try {
        return require('@react-native-async-storage/async-storage').default;
    } catch {
        // Fallback for SSR or when AsyncStorage is not available
        return {
            getItem: async () => null,
            setItem: async () => { },
            removeItem: async () => { },
        };
    }
};

// Storage functions
export const storage = {
    // Timetable cache
    async getTimetableCache(): Promise<any[] | null> {
        try {
            const AsyncStorage = getAsyncStorage();
            const data = await AsyncStorage.getItem(KEYS.TIMETABLE_CACHE);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setTimetableCache(entries: any[]): Promise<void> {
        try {
            const AsyncStorage = getAsyncStorage();
            await AsyncStorage.setItem(KEYS.TIMETABLE_CACHE, JSON.stringify(entries));
        } catch {
            // Ignore errors
        }
    },

    // User preferences
    async getPreferences(): Promise<UserPreferences | null> {
        try {
            const AsyncStorage = getAsyncStorage();
            const data = await AsyncStorage.getItem(KEYS.PREFERENCES);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setPreferences(prefs: UserPreferences): Promise<void> {
        try {
            const AsyncStorage = getAsyncStorage();
            await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(prefs));
        } catch {
            // Ignore errors
        }
    },

    // Selected class
    async getSelectedClass(): Promise<SelectedClass | null> {
        try {
            const AsyncStorage = getAsyncStorage();
            const data = await AsyncStorage.getItem(KEYS.SELECTED_CLASS);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setSelectedClass(classData: SelectedClass): Promise<void> {
        try {
            const AsyncStorage = getAsyncStorage();
            await AsyncStorage.setItem(KEYS.SELECTED_CLASS, JSON.stringify(classData));
        } catch {
            // Ignore errors
        }
    },

    // First launch status
    async isFirstLaunch(): Promise<boolean> {
        try {
            const AsyncStorage = getAsyncStorage();
            const value = await AsyncStorage.getItem(KEYS.FIRST_LAUNCH);
            return value !== 'false';
        } catch {
            return true;
        }
    },

    async setFirstLaunchComplete(): Promise<void> {
        try {
            const AsyncStorage = getAsyncStorage();
            await AsyncStorage.setItem(KEYS.FIRST_LAUNCH, 'false');
        } catch {
            // Ignore errors
        }
    },

    // User selections (for planner)
    async getUserSelections(): Promise<any[] | null> {
        try {
            const AsyncStorage = getAsyncStorage();
            const data = await AsyncStorage.getItem(KEYS.USER_SELECTIONS);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setUserSelections(selections: any[]): Promise<void> {
        try {
            const AsyncStorage = getAsyncStorage();
            await AsyncStorage.setItem(KEYS.USER_SELECTIONS, JSON.stringify(selections));
        } catch {
            // Ignore errors
        }
    },

    // Clear all data
    async clearAll(): Promise<void> {
        try {
            const AsyncStorage = getAsyncStorage();
            await Promise.all([
                AsyncStorage.removeItem(KEYS.TIMETABLE_CACHE),
                AsyncStorage.removeItem(KEYS.PREFERENCES),
                AsyncStorage.removeItem(KEYS.SELECTED_CLASS),
                AsyncStorage.removeItem(KEYS.FIRST_LAUNCH),
                AsyncStorage.removeItem(KEYS.USER_SELECTIONS),
            ]);
        } catch {
            // Ignore errors
        }
    },
};

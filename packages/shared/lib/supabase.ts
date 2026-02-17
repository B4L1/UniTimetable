// Supabase client configuration
// Web-compatible version that handles both mobile and web storage

import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

// Create a web-compatible storage adapter
const webStorage = {
    getItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
            return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
    },
    setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
    },
    removeItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
        }
        return Promise.resolve();
    },
};

const isWebRuntime = () =>
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Get appropriate storage based on platform
const getStorage = () => {
    if (isWebRuntime()) {
        return webStorage;
    }
    // For native, use AsyncStorage (lazy import to avoid SSR issues)
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        return AsyncStorage;
    } catch {
        return webStorage;
    }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: getStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

export type Database = {
    public: {
        Tables: {
            classes: {
                Row: {
                    id: string;
                    name: string;
                    faculty: string | null;
                    year: number;
                    group_code: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['classes']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['classes']['Insert']>;
            };
            timetable_entries: {
                Row: {
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
                };
                Insert: Omit<Database['public']['Tables']['timetable_entries']['Row'], 'id' | 'scraped_at'>;
                Update: Partial<Database['public']['Tables']['timetable_entries']['Insert']>;
            };
            user_selections: {
                Row: {
                    id: string;
                    user_id: string;
                    entry_id: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_selections']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['user_selections']['Insert']>;
            };
            user_preferences: {
                Row: {
                    user_id: string;
                    selected_class_id: string | null;
                    show_time_indicator: boolean;
                    theme: 'dark' | 'light';
                    language: 'hu' | 'en';
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_preferences']['Row'], 'updated_at'>;
                Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
            };
        };
    };
};

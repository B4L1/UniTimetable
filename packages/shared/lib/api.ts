// API functions for fetching data from Supabase

import { supabase } from './supabase';
import { storage } from './storage';
import { ClassData, TimetableEntry, Teacher } from './types';

export type { ClassData, TimetableEntry, Teacher };

export interface AvailableClassEntry extends TimetableEntry {
    class_name?: string;
    shared_classes?: string[];
}

// ---------------------------------------------------------------------------
// v3 dual-read adapter (SPEC_V3_PLAN.md Phase 2)
//
// Entry reads go to the v3 `events` table when migration 002 has been applied,
// and fall back to `timetable_entries` otherwise. The two differ only in a few
// column names; `entriesSource()` hides that so each fetch function has a
// single code path. Old tables stay authoritative for writes until Phase 5.
// ---------------------------------------------------------------------------

/** timetable_entries column name → events column name */
const V3_COL_MAP: Record<string, string> = {
    class_id: 'group_id',
    day_of_week: 'day',
    teacher_name: 'teacher',
    classroom: 'room',
    scraped_at: 'last_updated',
};

/** Map a v3 `events` row to the TimetableEntry shape the app consumes. */
export function mapEventRowToEntry(e: any): TimetableEntry {
    return {
        id: e.id,
        class_id: e.group_id,
        subject_name: e.subject_name,
        teacher_code: null,
        teacher_name: e.teacher ?? null,
        classroom: e.room ?? null,
        day_of_week: e.day,
        start_time: e.start_time,
        end_time: e.end_time,
        week_type: e.week_type,
        color: null,
        scraped_at: e.last_updated,
        course_id: e.course_id,
        event_type: e.type,
        week_type_source: e.week_type_source,
        source_hash: e.source_hash ?? null,
    };
}

let v3Available: boolean | null = null;

/**
 * True once migration 002 is live: the `events` table exists AND is non-empty
 * (an empty table would mean a partial migration — safer to keep reading the
 * old one). Probed once per session, cached.
 */
export async function isV3DataModelAvailable(): Promise<boolean> {
    if (v3Available !== null) return v3Available;
    try {
        const { count, error } = await supabase
            .from('events')
            .select('id', { count: 'exact', head: true });
        v3Available = !error && (count ?? 0) > 0;
    } catch {
        v3Available = false;
    }
    return v3Available;
}

/** Reset the cached probe (tests / after running the migration mid-session). */
export function resetV3Detection(): void {
    v3Available = null;
}

interface EntriesSource {
    table: 'events' | 'timetable_entries';
    /** Translate a timetable_entries column name for this source. */
    col: (name: string) => string;
    /** Normalize raw rows from this source to TimetableEntry[]. */
    mapRows: (rows: any[]) => TimetableEntry[];
}

async function entriesSource(): Promise<EntriesSource> {
    const useV3 = await isV3DataModelAvailable();
    if (useV3) {
        return {
            table: 'events',
            col: (name) => V3_COL_MAP[name] ?? name,
            mapRows: (rows) => rows.map(mapEventRowToEntry),
        };
    }
    return {
        table: 'timetable_entries',
        col: (name) => name,
        mapRows: (rows) => rows as TimetableEntry[],
    };
}

/**
 * Fetch all classes from Supabase
 */
export async function fetchClasses(): Promise<ClassData[]> {
    try {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .order('faculty')
            .order('year')
            .order('group_code');

        if (error) {
            console.error('Error fetching classes:', error.message);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Failed to fetch classes:', err);
        return [];
    }
}

/**
 * Fetch a single class by ID
 */
export async function fetchClassById(classId: string): Promise<ClassData | null> {
    try {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('id', classId)
            .single();

        if (error) {
            console.error('Error fetching class by id:', error.message);
            return null;
        }

        return data || null;
    } catch (err) {
        console.error('Failed to fetch class by id:', err);
        return null;
    }
}

/**
 * Fetch timetable entries for a specific class
 */
export async function fetchTimetableEntries(classId: string): Promise<TimetableEntry[]> {
    try {
        const src = await entriesSource();
        const { data, error } = await supabase
            .from(src.table)
            .select('*')
            .eq(src.col('class_id'), classId)
            .order(src.col('day_of_week'))
            .order('start_time');

        if (error) {
            console.error('Error fetching timetable:', error.message);
            return [];
        }

        const entries = src.mapRows(data || []);

        // Cache the data locally
        if (entries.length > 0) {
            await storage.setTimetableCache(entries);
        }

        return entries;
    } catch (err) {
        console.error('Failed to fetch timetable:', err);
        // Try to return cached data
        const cached = await storage.getTimetableCache();
        return cached || [];
    }
}

/**
 * Fetch available classes for planner (same faculty/year/semester)
 * If includeCrossMajor is true, it searches for the same subjects across ALL faculties/groups.
 */
export async function fetchAvailableClassesForPlanner(classId: string, importSubjects: string[] = [], includeCrossMajor: boolean = false): Promise<AvailableClassEntry[]> {
    try {
        // 1. Get the current class info
        const { data: classData } = await supabase
            .from('classes')
            .select('*')
            .eq('id', classId)
            .single();

        if (!classData) return [];

        // 2. Fetch all classes in the same faculty + year (Cohort)
        const { data: siblingClasses } = await supabase
            .from('classes')
            .select('id, name')
            .eq('faculty', classData.faculty)
            .eq('year', classData.year);

        if (!siblingClasses || siblingClasses.length === 0) return [];

        const siblingIds = siblingClasses.map(sc => sc.id);
        const src = await entriesSource();
        let entries: TimetableEntry[] = [];

        // Strategy 1: Standard Cohort Fetch
        const { data: standardEntries, error } = await supabase
            .from(src.table)
            .select('*')
            .in(src.col('class_id'), siblingIds)
            .order(src.col('day_of_week'))
            .order('start_time');

        if (error) throw error;
        entries = src.mapRows(standardEntries || []);

        // Strategy 2: Imported Subjects (Specific User Selections)
        if (importSubjects.length > 0) {
            // Fetch ALL entries for the imported subjects, regardless of faculty/year
            const { data: importedEntries } = await supabase
                .from(src.table)
                .select('*')
                .in('subject_name', importSubjects)
                .order(src.col('day_of_week'))
                .order('start_time');

            if (importedEntries) {
                // Merge, avoiding duplicates if they already exist in standard entries (e.g. if I import a subject I already have)
                const existingIds = new Set(entries.map(e => e.id));
                src.mapRows(importedEntries).forEach(ie => {
                    if (!existingIds.has(ie.id)) {
                        entries.push(ie);
                        existingIds.add(ie.id);
                    }
                });
            }
        }

        // Strategy 3: Legacy Cross-Major Search (Extended Search Toggle)
        if (includeCrossMajor) {
            // A. Get subjects of cohort
            const { data: subjectData } = await supabase
                .from(src.table)
                .select('subject_name')
                .in(src.col('class_id'), siblingIds);

            if (subjectData) {
                const uniqueSubjects = Array.from(new Set(subjectData.map(s => s.subject_name)));

                // Exclude subjects that were already handled by importSubjects to avoid redundant fetching
                const subjectsToFetch = uniqueSubjects.filter(s => !importSubjects.includes(s));

                if (subjectsToFetch.length > 0) {
                    // B. Fetch all entries with these subjects
                    const { data: allEntries } = await supabase
                        .from(src.table)
                        .select('*')
                        .in('subject_name', subjectsToFetch)
                        .order(src.col('day_of_week'))
                        .order('start_time');

                    if (allEntries) {
                        const existingIds = new Set(entries.map(e => e.id));
                        src.mapRows(allEntries).forEach(ae => {
                            if (!existingIds.has(ae.id)) {
                                entries.push(ae);
                                existingIds.add(ae.id);
                            }
                        });
                    }
                }
            }
        } // Added missing closing brace for if (includeCrossMajor)

        // 4. Enrich with class names
        // Note: For cross-major/imports, we might encounter class_ids NOT in siblingClasses.
        const neededClassIds = new Set(entries.map(e => e.class_id));
        const knownClassMap = new Map(siblingClasses.map(c => [c.id, c.name]));
        const missingClassIds = Array.from(neededClassIds).filter(id => !knownClassMap.has(id));

        if (missingClassIds.length > 0) {
            const { data: extraClasses } = await supabase
                .from('classes')
                .select('id, name')
                .in('id', missingClassIds);

            extraClasses?.forEach(c => knownClassMap.set(c.id, c.name));
        }

        const enriched = entries.map(entry => {
            return {
                ...entry,
                class_name: knownClassMap.get(entry.class_id) || 'Ismeretlen csoport',
            };
        });

        return enriched || [];
    } catch (err) {
        console.error('Failed to fetch planner entries:', err);
        return [];
    }
}

/**
 * Fetch merged timetable entries for ALL groups in a given faculty + year
 * Useful for importing subjects where group doesn't matter (or user wants all options)
 */
export async function fetchTimetableEntriesForFacultyYear(faculty: string, year: number): Promise<TimetableEntry[]> {
    try {
        // 1. Fetch all classes in the same faculty + year
        const { data: siblingClasses } = await supabase
            .from('classes')
            .select('id')
            .eq('faculty', faculty)
            .eq('year', year);

        if (!siblingClasses || siblingClasses.length === 0) return [];

        const siblingIds = siblingClasses.map(sc => sc.id);

        // 2. Fetch all timetable entries for these classes
        const src = await entriesSource();
        const { data: entries, error } = await supabase
            .from(src.table)
            .select('*')
            .in(src.col('class_id'), siblingIds)
            .order(src.col('day_of_week'))
            .order('start_time');

        if (error) {
            console.error('Error fetching faculty year entries:', error.message);
            return [];
        }

        return src.mapRows(entries || []);
    } catch (err) {
        console.error('Failed to fetch faculty year entries:', err);
        return [];
    }
}

/**
 * Get unique faculties from classes
 */
export function getUniqueFaculties(classes: ClassData[]): string[] {
    const faculties = new Set<string>();
    classes.forEach(c => {
        if (c.faculty) faculties.add(c.faculty);
    });
    return Array.from(faculties).sort();
}

/**
 * Get years available for a faculty
 */
export function getYearsForFaculty(classes: ClassData[], faculty: string): number[] {
    const years = new Set<number>();
    classes
        .filter(c => c.faculty === faculty)
        .forEach(c => {
            if (c.year) years.add(c.year);
        });
    return Array.from(years).sort();
}

/**
 * Get groups available for a faculty and year
 */
export function getGroupsForFacultyYear(classes: ClassData[], faculty: string, year: number): string[] {
    const groups = new Set<string>();
    classes
        .filter(c => c.faculty === faculty && c.year === year)
        .forEach(c => {
            if (c.group_code) groups.add(c.group_code);
        });
    return Array.from(groups).sort();
}

/**
 * Find class by faculty, year, and group
 */
export function findClass(classes: ClassData[], faculty: string, year: number, groupCode: string): ClassData | undefined {
    return classes.find(c =>
        c.faculty === faculty &&
        c.year === year &&
        c.group_code === groupCode
    );
}

/**
 * Fetch timetable entries by their IDs (for user selections)
 * Enriched with class name for context
 */
export async function fetchTimetableEntriesByIds(entryIds: string[]): Promise<AvailableClassEntry[]> {
    if (entryIds.length === 0) return [];

    try {
        const src = await entriesSource();
        const { data: rawEntries, error } = await supabase
            .from(src.table)
            .select('*')
            .in('id', entryIds)
            .order(src.col('day_of_week'))
            .order('start_time');

        if (error) {
            console.error('Error fetching entries by IDs:', error.message);
            return [];
        }

        if (!rawEntries || rawEntries.length === 0) return [];
        const entries = src.mapRows(rawEntries);

        // Fetch class names
        const classIds = Array.from(new Set(entries.map(e => e.class_id)));
        const { data: classes } = await supabase
            .from('classes')
            .select('id, name')
            .in('id', classIds);

        const classMap = new Map((classes || []).map(c => [c.id, c.name]));

        return entries.map(entry => ({
            ...entry,
            class_name: classMap.get(entry.class_id) || 'Unknown Class'
        }));
    } catch (err) {
        console.error('Failed to fetch entries by IDs:', err);
        return [];
    }
}

/**
 * Search for timetable entries by subject name (globally)
 */
export async function searchTimetableEntriesBySubject(query: string): Promise<AvailableClassEntry[]> {
    if (!query || query.trim().length < 2) return [];

    try {
        // 1. Search entries
        const src = await entriesSource();
        const { data: rawEntries, error } = await supabase
            .from(src.table)
            .select('*')
            .ilike('subject_name', `%${query}%`)
            .order('subject_name')
            .limit(50); // Limit to prevent massive fetches

        if (error) {
            console.error('Error searching subjects:', error.message);
            return [];
        }

        if (!rawEntries || rawEntries.length === 0) return [];
        const entries = src.mapRows(rawEntries);

        // 2. Fetch class names for context
        const classIds = Array.from(new Set(entries.map(e => e.class_id)));
        const { data: classes } = await supabase
            .from('classes')
            .select('id, name')
            .in('id', classIds);

        const classMap = new Map((classes || []).map(c => [c.id, c.name]));

        // 3. Enrich
        return entries.map(entry => ({
            ...entry,
            class_name: classMap.get(entry.class_id) || 'Unknown Class'
        }));

    } catch (err) {
        console.error('Failed to search subjects:', err);
        return [];
    }
}

/**
 * Fetch user preferences from Supabase
 */
export async function fetchUserPreferences(userId: string): Promise<any | null> {
    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found'
            console.error('Error fetching user preferences:', error.message);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Failed to fetch user preferences:', err);
        return null;
    }
}

/**
 * Upsert user preferences to Supabase
 */
export async function upsertUserPreferences(userId: string, data: any): Promise<void> {
    try {
        const { error } = await supabase
            .from('user_preferences')
            .upsert({
                user_id: userId,
                ...data,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            console.error('Error upserting user preferences:', error.message);
        }
    } catch (err) {
        console.error('Failed to upsert user preferences:', err);
    }
}

/**
 * Fetch user selections (custom timetable) from Supabase
 */
export async function fetchUserSelections(userId: string): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('user_selections')
            .select('entry_id')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching user selections:', error.message);
            return [];
        }

        return data.map(d => d.entry_id) || [];
    } catch (err) {
        console.error('Failed to fetch user selections:', err);
        return [];
    }
}

/**
 * Update user selections (custom timetable) in Supabase
 * This replaces the previous selections with the new ones.
 */
export async function updateUserSelections(userId: string, entryIds: string[]): Promise<void> {
    try {
        // 1. Delete existing selections
        const { error: deleteError } = await supabase
            .from('user_selections')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            console.error('Error deleting old user selections:', deleteError.message);
            return;
        }

        if (entryIds.length === 0) return;

        // 2. Insert new selections
        const inserts = entryIds.map(entryId => ({
            user_id: userId,
            entry_id: entryId,
        }));

        const { error: insertError } = await supabase
            .from('user_selections')
            .insert(inserts);

        if (insertError) {
            console.error('Error inserting new user selections:', insertError.message);
        }
    } catch (err) {
        console.error('Failed to update user selections:', err);
    }
}

// ---------------------------------------------------------------------------
// user_event_preferences (v3 Phase 5 — lock/exclude, spec §A13)
// One row per (user, event) that the user has locked and/or excluded. A row
// with both flags false is meaningless, so we delete it instead of storing it.
// ---------------------------------------------------------------------------

export interface UserEventPreferences {
    /** event ids the user pinned — the generator must keep these */
    locked: string[];
    /** event ids the user banned — the generator must never reintroduce */
    excluded: string[];
}

export async function fetchUserEventPreferences(userId: string): Promise<UserEventPreferences> {
    try {
        const { data, error } = await supabase
            .from('user_event_preferences')
            .select('event_id, locked, excluded')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching user event preferences:', error.message);
            return { locked: [], excluded: [] };
        }

        const locked: string[] = [];
        const excluded: string[] = [];
        for (const row of data ?? []) {
            if (row.locked) locked.push(row.event_id);
            if (row.excluded) excluded.push(row.event_id);
        }
        return { locked, excluded };
    } catch (err) {
        console.error('Failed to fetch user event preferences:', err);
        return { locked: [], excluded: [] };
    }
}

/**
 * Set (or clear) one event's lock/exclude flags for a user. When both flags
 * are false the row is deleted so the table only ever holds meaningful state.
 */
export async function setUserEventPreference(
    userId: string,
    eventId: string,
    flags: { locked: boolean; excluded: boolean },
): Promise<void> {
    try {
        if (!flags.locked && !flags.excluded) {
            const { error } = await supabase
                .from('user_event_preferences')
                .delete()
                .eq('user_id', userId)
                .eq('event_id', eventId);
            if (error) console.error('Error clearing event preference:', error.message);
            return;
        }

        const { error } = await supabase
            .from('user_event_preferences')
            .upsert({
                user_id: userId,
                event_id: eventId,
                locked: flags.locked,
                excluded: flags.excluded,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,event_id' });
        if (error) console.error('Error upserting event preference:', error.message);
    } catch (err) {
        console.error('Failed to set user event preference:', err);
    }
}

/**
 * Fetch all teachers from Supabase
 */
export async function fetchTeachers(): Promise<Teacher[]> {
    try {
        const { data, error } = await supabase
            .from('teachers')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching teachers:', error.message);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Failed to fetch teachers:', err);
        return [];
    }
}

/**
 * Fetch timetable entries for a specific teacher
 *
 * Stays on timetable_entries even in dual-read mode: `events` has no
 * teacher_id column (only the teacher display name). Moves over in Phase 6
 * when the scraper writes events directly.
 */
export async function fetchTeacherTimetable(teacherId: string): Promise<TimetableEntry[]> {
    try {
        const { data, error } = await supabase
            .from('timetable_entries')
            .select('*')
            .eq('teacher_id', teacherId)
            .order('day_of_week')
            .order('start_time');

        if (error) {
            console.error('Error fetching teacher timetable:', error.message);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Failed to fetch teacher timetable:', err);
        return [];
    }
}

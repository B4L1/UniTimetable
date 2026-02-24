// API functions for fetching data from Supabase

import { supabase } from './supabase';
import { storage } from './storage';
import { ClassData, TimetableEntry } from './types';

export type { ClassData, TimetableEntry };

export interface AvailableClassEntry extends TimetableEntry {
    class_name?: string;
    shared_classes?: string[];
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
 * Fetch timetable entries for a specific class
 */
export async function fetchTimetableEntries(classId: string): Promise<TimetableEntry[]> {
    try {
        const { data, error } = await supabase
            .from('timetable_entries')
            .select('*')
            .eq('class_id', classId)
            .order('day_of_week')
            .order('start_time');

        if (error) {
            console.error('Error fetching timetable:', error.message);
            return [];
        }

        // Cache the data locally
        if (data && data.length > 0) {
            await storage.setTimetableCache(data);
        }

        return data || [];
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
        let entries: TimetableEntry[] = [];

        // Strategy 1: Standard Cohort Fetch
        const { data: standardEntries, error } = await supabase
            .from('timetable_entries')
            .select('*')
            .in('class_id', siblingIds)
            .order('day_of_week')
            .order('start_time');

        if (error) throw error;
        entries = standardEntries || [];

        // Strategy 2: Imported Subjects (Specific User Selections)
        if (importSubjects.length > 0) {
            // Fetch ALL entries for the imported subjects, regardless of faculty/year
            const { data: importedEntries } = await supabase
                .from('timetable_entries')
                .select('*')
                .in('subject_name', importSubjects)
                .order('day_of_week')
                .order('start_time');

            if (importedEntries) {
                // Merge, avoiding duplicates if they already exist in standard entries (e.g. if I import a subject I already have)
                const existingIds = new Set(entries.map(e => e.id));
                importedEntries.forEach(ie => {
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
                .from('timetable_entries')
                .select('subject_name')
                .in('class_id', siblingIds);

            if (subjectData) {
                const uniqueSubjects = Array.from(new Set(subjectData.map(s => s.subject_name)));

                // Exclude subjects that were already handled by importSubjects to avoid redundant fetching
                const subjectsToFetch = uniqueSubjects.filter(s => !importSubjects.includes(s));

                if (subjectsToFetch.length > 0) {
                    // B. Fetch all entries with these subjects
                    const { data: allEntries } = await supabase
                        .from('timetable_entries')
                        .select('*')
                        .in('subject_name', subjectsToFetch)
                        .order('day_of_week')
                        .order('start_time');

                    if (allEntries) {
                        const existingIds = new Set(entries.map(e => e.id));
                        allEntries.forEach(ae => {
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
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('*')
            .in('class_id', siblingIds)
            .order('day_of_week')
            .order('start_time');

        if (error) {
            console.error('Error fetching faculty year entries:', error.message);
            return [];
        }

        return entries || [];
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
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('*')
            .in('id', entryIds)
            .order('day_of_week')
            .order('start_time');

        if (error) {
            console.error('Error fetching entries by IDs:', error.message);
            return [];
        }

        if (!entries || entries.length === 0) return [];

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
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('*')
            .ilike('subject_name', `%${query}%`)
            .order('subject_name')
            .limit(50); // Limit to prevent massive fetches

        if (error) {
            console.error('Error searching subjects:', error.message);
            return [];
        }

        if (!entries || entries.length === 0) return [];

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

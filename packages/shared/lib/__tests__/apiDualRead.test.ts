import { describe, it, expect, vi } from 'vitest';

// api.ts imports the shared supabase client, whose auth layer touches
// AsyncStorage/window at module load — stub it out; the mapper is pure.
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../storage', () => ({ storage: {} }));

import { mapEventRowToEntry } from '../api';
import { getBaseSubjectName } from '../colors';

// Raw row exactly as PostgREST returns it from the v3 `events` table
const eventRow = {
    id: '819027d1-f06b-43eb-9ebb-d36256b150ef',
    course_id: 'c0ffee00-0000-4000-8000-000000000001',
    group_id: '86388d18-382a-49b2-9142-2eb40a037cd0',
    subject_name: 'Információ keresés gyak.',
    type: 'lab',
    teacher: 'Hajdú Sz.',
    room: 'Real',
    day: 2,
    start_time: '14:30:00',
    end_time: '16:20:00',
    week_type: 'odd',
    week_type_source: 'manual',
    source_hash: 'abc123',
    last_updated: '2026-07-12T10:00:00+00:00',
    edupage_id: null,
};

describe('mapEventRowToEntry (v3 dual-read adapter)', () => {
    it('maps renamed columns onto the TimetableEntry shape', () => {
        const entry = mapEventRowToEntry(eventRow);
        expect(entry.id).toBe(eventRow.id);
        expect(entry.class_id).toBe(eventRow.group_id);
        expect(entry.subject_name).toBe(eventRow.subject_name);
        expect(entry.teacher_name).toBe(eventRow.teacher);
        expect(entry.classroom).toBe(eventRow.room);
        expect(entry.day_of_week).toBe(eventRow.day);
        expect(entry.start_time).toBe(eventRow.start_time);
        expect(entry.end_time).toBe(eventRow.end_time);
        expect(entry.week_type).toBe('odd');
        expect(entry.scraped_at).toBe(eventRow.last_updated);
    });

    it('carries the v3-only fields through', () => {
        const entry = mapEventRowToEntry(eventRow);
        expect(entry.course_id).toBe(eventRow.course_id);
        expect(entry.event_type).toBe('lab');
        expect(entry.week_type_source).toBe('manual');
        expect(entry.source_hash).toBe('abc123');
    });

    it('fills legacy-only columns with nulls instead of undefined', () => {
        const entry = mapEventRowToEntry({ ...eventRow, teacher: null, room: null, source_hash: null });
        expect(entry.teacher_code).toBeNull();
        expect(entry.color).toBeNull();
        expect(entry.teacher_name).toBeNull();
        expect(entry.classroom).toBeNull();
        expect(entry.source_hash).toBeNull();
    });

    it('keeps subject_name compatible with color hashing', () => {
        // The whole point of storing subject_name on events: the color key
        // must be identical whether the row came from the old or new table.
        const entry = mapEventRowToEntry(eventRow);
        expect(getBaseSubjectName(entry.subject_name)).toBe('információ keresés');
    });
});

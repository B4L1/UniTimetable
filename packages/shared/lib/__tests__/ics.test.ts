import { describe, it, expect } from 'vitest';
import { generateICS, type IcsEntry } from '../ics';

const entry = (overrides: Partial<IcsEntry> = {}): IcsEntry => ({
    id: 'e1',
    subject_name: 'Kriptográfia és adatbiztonság',
    teacher_name: 'Márton Gy.',
    classroom: 'INF 414 Lab',
    day_of_week: 0, // Monday
    start_time: '08:00',
    end_time: '09:50',
    week_type: 'all',
    ...overrides,
});

describe('generateICS', () => {
    it('produces a well-formed VCALENDAR wrapper', () => {
        const ics = generateICS([entry()], { referenceDate: new Date('2025-10-01T12:00:00Z') });
        expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
        expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
        expect(ics).toContain('VERSION:2.0');
        expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(1);
    });

    it('anchors DTSTART on the correct weekday within the resolved semester', () => {
        // Semester 1 starts Monday 2025-09-15. A Monday class should start
        // on that exact date; a Wednesday class on 2025-09-17.
        const ics = generateICS(
            [entry({ day_of_week: 0 }), entry({ id: 'e2', day_of_week: 2 })],
            { referenceDate: new Date('2025-10-01T12:00:00Z') },
        );
        expect(ics).toMatch(/DTSTART:20250915T0[56]0000Z/); // Monday, 08:00 local -> 05 or 06 UTC
        expect(ics).toMatch(/DTSTART:20250917T0[56]0000Z/); // Wednesday
    });

    it('converts Bucharest local time to UTC correctly across DST', () => {
        // Mid-September (2025-09-15) is still EEST (+3) — Romania's DST runs
        // to the last Sunday of October. 08:00 local -> 05:00 UTC.
        const septIcs = generateICS([entry({ day_of_week: 0 })], { referenceDate: new Date('2025-10-01T12:00:00Z') });
        expect(septIcs).toContain('DTSTART:20250915T050000Z');
        expect(septIcs).toContain('DTEND:20250915T065000Z');

        // Mid-February (semester 2 starts 2026-02-16, a Monday) is EET (+2)
        // — before the last Sunday of March. 08:00 local -> 06:00 UTC.
        const febIcs = generateICS([entry({ day_of_week: 0 })], { referenceDate: new Date('2026-03-01T12:00:00Z') });
        expect(febIcs).toContain('DTSTART:20260216T060000Z');
    });

    it('weekly ("all") entries recur with INTERVAL=1', () => {
        const ics = generateICS([entry({ week_type: 'all' })], { referenceDate: new Date('2025-10-01T12:00:00Z') });
        expect(ics).toMatch(/RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=\d{8}T\d{6}Z/);
    });

    it('odd/even entries recur bi-weekly, anchored to the matching parity', () => {
        // Semester 1 week 1 (starting 2025-09-15) is odd (weekNum 1). An
        // "odd" Monday class should anchor on week 1's Monday itself; an
        // "even" Monday class should skip to week 2's Monday (2025-09-22).
        const oddIcs = generateICS([entry({ week_type: 'odd' })], { referenceDate: new Date('2025-10-01T12:00:00Z') });
        const evenIcs = generateICS([entry({ week_type: 'even' })], { referenceDate: new Date('2025-10-01T12:00:00Z') });

        expect(oddIcs).toContain('DTSTART:20250915T050000Z');
        expect(oddIcs).toMatch(/RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO/);

        expect(evenIcs).toContain('DTSTART:20250922T050000Z');
        expect(evenIcs).toMatch(/RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO/);
    });

    it('escapes TEXT values and includes location/description', () => {
        const ics = generateICS(
            [entry({ subject_name: 'Test, Subject; With\\Special', classroom: 'Room 1', teacher_name: 'A, B' })],
            { referenceDate: new Date('2025-10-01T12:00:00Z') },
        );
        expect(ics).toContain('SUMMARY:Test\\, Subject\\; With\\\\Special');
        expect(ics).toContain('LOCATION:Room 1');
        expect(ics).toContain('DESCRIPTION:A\\, B');
    });

    it('folds lines longer than 75 octets per RFC 5545', () => {
        const longName = 'Nagyon hosszú tantárgynév, ami biztosan túllépi a hetvenöt karakteres sortörési határt ismételten';
        const ics = generateICS([entry({ subject_name: longName })], { referenceDate: new Date('2025-10-01T12:00:00Z') });
        const lines = ics.split('\r\n');
        for (const line of lines) {
            expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
        }
        // The folded continuation must still be present, joined back together
        // (strip the CRLF+space folding to check content survived).
        expect(ics.replace(/\r\n /g, '')).toContain(longName.replace(/,/g, '\\,'));
    });

    it('skips entries with no valid weekday (day_of_week out of Mon–Sat range)', () => {
        const ics = generateICS([entry({ day_of_week: 6 }), entry({ id: 'e2', day_of_week: -1 })]);
        expect(ics).not.toContain('BEGIN:VEVENT');
    });

    it('falls back to the most recent semester when the reference date is out of term (e.g. summer break)', () => {
        const ics = generateICS([entry({ day_of_week: 0 })], { referenceDate: new Date('2026-07-01T12:00:00Z') });
        // Should resolve to semester 2 (the last one that ran), not crash or emit nothing.
        expect(ics).toContain('DTSTART:20260216T060000Z');
    });

    it('includes X-WR-CALNAME when a calendar name is given', () => {
        const ics = generateICS([entry()], { calendarName: 'Informatika III.B.', referenceDate: new Date('2025-10-01T12:00:00Z') });
        expect(ics).toContain('X-WR-CALNAME:Informatika III.B.');
    });
});

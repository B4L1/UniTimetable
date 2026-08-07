// .ics (RFC 5545) calendar export — turns the timetable into recurring
// events a real calendar app can subscribe to, instead of a PNG you can only
// look at. Shared so web and mobile can both offer it.
import { SEMESTERS, getAcademicWeek, type SemesterBounds } from './calendar';

export interface IcsEntry {
    id: string;
    subject_name: string;
    teacher_name?: string | null;
    teacher_code?: string | null;
    classroom?: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
    week_type: 'all' | 'odd' | 'even';
}

// ── Europe/Bucharest local time → UTC ───────────────────────────────────
// Every entry's start/end time is a Bucharest wall-clock time (the university
// doesn't run on any other timezone), but ICS DTSTART/DTEND need to be
// unambiguous. Emitting them as UTC (rather than a floating time or a full
// VTIMEZONE block) is the simplest thing that's still correct for a student
// opening the file from a different timezone. Romania follows EU DST rules:
// last Sunday of March 01:00 UTC → EEST (+3), last Sunday of October
// 01:00 UTC → EET (+2).
function lastSundayUTC(year: number, monthIndex0: number): Date {
    const d = new Date(Date.UTC(year, monthIndex0 + 1, 0)); // last day of month
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    d.setUTCHours(1, 0, 0, 0);
    return d;
}

function bucharestOffsetMinutes(utcGuess: Date): number {
    const year = utcGuess.getUTCFullYear();
    const dstStart = lastSundayUTC(year, 2); // March
    const dstEnd = lastSundayUTC(year, 9); // October
    return utcGuess >= dstStart && utcGuess < dstEnd ? 180 : 120;
}

/** A Bucharest wall-clock date/time → the equivalent instant in UTC. */
function bucharestToUTC(year: number, monthIndex0: number, day: number, hour: number, minute: number): Date {
    const naiveUTC = new Date(Date.UTC(year, monthIndex0, day, hour, minute));
    const offset = bucharestOffsetMinutes(naiveUTC);
    return new Date(naiveUTC.getTime() - offset * 60_000);
}

function parseHM(hm: string): [number, number] {
    const [h, m] = hm.split(':').map(Number);
    return [h || 0, m || 0];
}

// ── ICS primitives ───────────────────────────────────────────────────────
function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** UTC Date → "YYYYMMDDTHHMMSSZ" */
function toIcsUTC(d: Date): string {
    return (
        `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
        `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
    );
}

/** Escape TEXT-type values per RFC 5545 §3.3.11. */
function escapeText(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Fold lines longer than 75 octets, as RFC 5545 §3.1 requires. */
function foldLine(line: string): string {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;
    const out: string[] = [];
    let rest = line;
    let first = true;
    while (rest.length > 0) {
        const limit = first ? 75 : 74; // continuation lines lose 1 char to the leading space
        // Slice by UTF-16 code units is close enough here: subject names are
        // Hungarian text, not astral-plane characters.
        let chunk = rest.slice(0, limit);
        while (new TextEncoder().encode(chunk).length > (first ? 75 : 74) && chunk.length > 0) {
            chunk = chunk.slice(0, -1);
        }
        out.push((first ? '' : ' ') + chunk);
        rest = rest.slice(chunk.length);
        first = false;
    }
    return out.join('\r\n');
}

const DAY_NAMES_EN = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

/** The current semester if one is running "now", else the next one that
 *  will start, else the last one that ran (so export never just fails
 *  during summer break — it's still meaningful to export "next semester"
 *  or "how my last semester looked"). */
function resolveSemester(now: Date): SemesterBounds {
    const week = getAcademicWeek(now);
    if (week.semester === 1 || week.semester === 2) {
        return SEMESTERS.find(s => s.semester === week.semester)!;
    }
    const upcoming = SEMESTERS.filter(s => s.start > now).sort((a, b) => a.start.getTime() - b.start.getTime());
    return upcoming[0] ?? SEMESTERS[SEMESTERS.length - 1];
}

/** First date on/after `from` that falls on the given weekday (0=Mon..6=Sun,
 *  matching day_of_week). */
function firstWeekdayOnOrAfter(from: Date, dayOfWeek: number): Date {
    const fromDow = (from.getUTCDay() + 6) % 7; // JS: 0=Sun → 0=Mon
    const delta = (dayOfWeek - fromDow + 7) % 7;
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + delta);
    return d;
}

function buildEvent(entry: IcsEntry, semester: SemesterBounds, now: Date): string {
    const [startH, startM] = parseHM(entry.start_time);
    const [endH, endM] = parseHM(entry.end_time);

    // First calendar date matching the entry's weekday, on/after semester start.
    let firstDate = firstWeekdayOnOrAfter(semester.start, entry.day_of_week);
    let interval = 1;

    if (entry.week_type !== 'all') {
        interval = 2;
        // Nudge forward one week if the first weekday hit doesn't match the
        // entry's own parity (odd/even weeks alternate, so it's never more
        // than one week off).
        const parity = getAcademicWeek(firstDate).type;
        if (parity !== entry.week_type) {
            firstDate = new Date(firstDate);
            firstDate.setUTCDate(firstDate.getUTCDate() + 7);
        }
    }

    const y = firstDate.getUTCFullYear();
    const mo = firstDate.getUTCMonth();
    const day = firstDate.getUTCDate();

    const dtStart = bucharestToUTC(y, mo, day, startH, startM);
    const dtEnd = bucharestToUTC(y, mo, day, endH, endM);
    // UNTIL is inclusive of time-of-day, so push it to end-of-day on the
    // semester's last date to make sure that date's own class isn't dropped.
    const until = bucharestToUTC(
        semester.end.getUTCFullYear(), semester.end.getUTCMonth(), semester.end.getUTCDate(), 23, 59,
    );

    const teacher = entry.teacher_name || entry.teacher_code || '';
    const descriptionParts = [teacher].filter(Boolean);

    const lines = [
        'BEGIN:VEVENT',
        `UID:${entry.id}-${entry.week_type}@unitimetable`,
        `DTSTAMP:${toIcsUTC(now)}`,
        `DTSTART:${toIcsUTC(dtStart)}`,
        `DTEND:${toIcsUTC(dtEnd)}`,
        `RRULE:FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${DAY_NAMES_EN[entry.day_of_week]};UNTIL=${toIcsUTC(until)}`,
        `SUMMARY:${escapeText(entry.subject_name)}`,
    ];
    if (entry.classroom) lines.push(`LOCATION:${escapeText(entry.classroom)}`);
    if (descriptionParts.length) lines.push(`DESCRIPTION:${escapeText(descriptionParts.join(', '))}`);
    lines.push('END:VEVENT');

    return lines.map(foldLine).join('\r\n');
}

export interface GenerateIcsOptions {
    /** Shown as the calendar's own name in apps that support X-WR-CALNAME. */
    calendarName?: string;
    /** Defaults to now — overridable for tests / a specific semester. */
    referenceDate?: Date;
}

/**
 * Build a complete .ics file (RFC 5545) from a timetable's entries. Entries
 * outside Monday–Saturday (day_of_week 0–5) or missing a day are skipped —
 * an .ics event needs a real weekday to recur on.
 */
export function generateICS(entries: IcsEntry[], opts: GenerateIcsOptions = {}): string {
    const now = opts.referenceDate ?? new Date();
    const semester = resolveSemester(now);

    const events = entries
        .filter(e => e.day_of_week >= 0 && e.day_of_week <= 5)
        .map(e => buildEvent(e, semester, now));

    const header = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//UniTimetable//HU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];
    if (opts.calendarName) header.push(foldLine(`X-WR-CALNAME:${escapeText(opts.calendarName)}`));

    return [...header, ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

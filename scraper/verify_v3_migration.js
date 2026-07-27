// Phase 2 verification (SPEC_V3_PLAN.md) — run AFTER applying
// supabase/migrations/002_v3_data_model.sql in the Supabase SQL editor:
//
//   node scraper/verify_v3_migration.js
//
// Checks the backfill invariants and dumps v_split_slot_review for the
// B7a teacher-timetable disambiguation pass.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function count(table, filter) {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count: n, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return n;
}

async function main() {
    let failed = false;
    const check = (name, ok, detail) => {
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed = true;
    };

    const oldEntries = await count('timetable_entries');
    const events = await count('events').catch(() => null);

    if (events === null) {
        console.log('FAIL  `events` table not reachable — has migration 002 been run?');
        process.exit(1);
    }

    const courses = await count('courses');
    const untyped = await count('events', q => q.eq('type', 'other'));
    const nonScraped = await count('events', q => q.neq('week_type_source', 'scraped'));

    check('events row count matches timetable_entries', events === oldEntries,
        `events=${events}, timetable_entries=${oldEntries}`);
    check('courses backfilled', courses > 0, `courses=${courses}`);
    check('week_type_source all "scraped" after fresh backfill', nonScraped === 0,
        `non-scraped=${nonScraped}`);
    console.log(`INFO  events with type='other' (no e.a./gyak./szem./lab. suffix): ${untyped}`);

    // Every event must reference a course whose norm_name matches its subject
    const { data: sample, error: sErr } = await supabase
        .from('events')
        .select('subject_name, courses(norm_name)')
        .limit(1000);
    if (sErr) throw new Error(sErr.message);
    const mismatches = (sample || []).filter(e => {
        const base = e.subject_name.trim()
            .replace(/\s+(e\.a\.|gyak\.|szem\.|lab\.|koll\.)$/i, '')
            .trim().toLowerCase();
        return e.courses?.norm_name !== base;
    });
    check('event→course links match the colors.ts normalization (first 1000)',
        mismatches.length === 0,
        mismatches.length ? `e.g. "${mismatches[0].subject_name}" → "${mismatches[0].courses?.norm_name}"` : undefined);

    // Split-slot review dump (B7a) — the entries needing teacher-view checks
    const { data: splits, error: vErr } = await supabase
        .from('v_split_slot_review')
        .select('*')
        .order('group_name');
    if (vErr) {
        check('v_split_slot_review readable', false, vErr.message);
    } else {
        console.log(`\n--- v_split_slot_review: ${splits.length} slot(s) needing B7a teacher-view checks ---`);
        const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (const s of splits) {
            console.log(`${s.group_name}  ${DAYS[s.day] ?? s.day} ${s.start_time}`);
            console.log(`   A: ${s.course_a}  (${s.teacher_a ?? '?'} / ${s.room_a ?? '?'})`);
            console.log(`   B: ${s.course_b}  (${s.teacher_b ?? '?'} / ${s.room_b ?? '?'})`);
            console.log(`   check teacher timetable(s): ${(s.teachers_to_check || []).join(', ') || 'NONE — mark ambiguous'}`);
        }
    }

    console.log(failed ? '\nRESULT: FAILED — see above' : '\nRESULT: all checks passed');
    process.exit(failed ? 1 : 0);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });

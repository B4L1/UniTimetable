-- UniTimetable v3 data model (SPEC_V3_PLAN.md Phase 2) — 2026-07-12
-- Run in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vnuglyosnikpcagjudid/sql
--
-- ADDITIVE migration: creates the courses/events model alongside the old
-- tables and backfills from timetable_entries. Nothing is dropped; the app
-- switches reads over gradually (dual-read), old tables retire after Phase 5.
--
-- Key decisions:
--  * events.id = timetable_entries.id  → user_selections stay valid as-is
--  * course grouping mirrors shared/lib/colors.ts getBaseSubjectName()
--    EXACTLY (strip " e.a./gyak./szem./lab./koll." suffix, trim, lowercase)
--    so course identity matches the client's color identity
--  * week_type_source makes parity provenance explicit (B7a): scraped values
--    are just claims; derivation/manual fixes upgrade them, ambiguity is
--    allowed to be visible instead of baked in as wrong data

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,             -- display name (base name, original casing)
  norm_name TEXT NOT NULL UNIQUE, -- normalized base name (matching key)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,                          -- = timetable_entries.id
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  group_id UUID REFERENCES classes(id) ON DELETE CASCADE, -- cohort ("group" in spec)
  subject_name TEXT NOT NULL,                   -- original display string incl. suffix
    -- kept because the UI renders it verbatim and the suffix ("gyak." vs "lab.")
    -- is not recoverable from `type`; color hashing also keys off it
  type TEXT NOT NULL DEFAULT 'other',           -- lecture | lab | seminar | other
  teacher TEXT,
  room TEXT,
  day SMALLINT NOT NULL,                        -- 0=Mon … 5=Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  week_type TEXT NOT NULL DEFAULT 'all',        -- all | odd | even
  week_type_source TEXT NOT NULL DEFAULT 'scraped',
    -- scraped | derived-teacher | derived-room | derived-groupswap | manual | ambiguous
  source_hash TEXT,                             -- diff detection (spec §14)
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  edupage_id TEXT
);

CREATE TABLE IF NOT EXISTS user_course_selection (
  user_id TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  included BOOLEAN NOT NULL DEFAULT TRUE,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS user_constraints (
  user_id TEXT PRIMARY KEY,
  allowed_days SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5}',
  earliest_start TIME NOT NULL DEFAULT '08:00',
  latest_end TIME NOT NULL DEFAULT '20:30',
  w_gaps REAL NOT NULL DEFAULT 1.0,
  w_early REAL NOT NULL DEFAULT 1.5,
  w_days REAL NOT NULL DEFAULT 2.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_event_preferences (
  user_id TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_events_course ON events(course_id);
CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
CREATE INDEX IF NOT EXISTS idx_ucs_user ON user_course_selection(user_id);
CREATE INDEX IF NOT EXISTS idx_uep_user ON user_event_preferences(user_id);

-- ---------------------------------------------------------------------------
-- 2) Backfill — courses from normalized subject names
--    (regex mirrors getBaseSubjectName in packages/shared/lib/colors.ts)
-- ---------------------------------------------------------------------------

INSERT INTO courses (name, norm_name)
SELECT DISTINCT ON (norm)
  trim(regexp_replace(subject_name, '\s+(e\.a\.|gyak\.|szem\.|lab\.|koll\.)$', '', 'i')) AS display,
  lower(trim(regexp_replace(subject_name, '\s+(e\.a\.|gyak\.|szem\.|lab\.|koll\.)$', '', 'i'))) AS norm
FROM timetable_entries
ORDER BY lower(trim(regexp_replace(subject_name, '\s+(e\.a\.|gyak\.|szem\.|lab\.|koll\.)$', '', 'i'))), subject_name
ON CONFLICT (norm_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Backfill — events from timetable_entries (id-preserving)
-- ---------------------------------------------------------------------------

INSERT INTO events (id, course_id, group_id, subject_name, type, teacher, room, day,
                    start_time, end_time, week_type, week_type_source,
                    source_hash, last_updated, edupage_id)
SELECT
  te.id,
  c.id,
  te.class_id,
  te.subject_name,
  CASE
    WHEN te.subject_name ~* '\se\.a\.$'  THEN 'lecture'
    WHEN te.subject_name ~* '\sgyak\.$'  THEN 'lab'
    WHEN te.subject_name ~* '\slab\.$'   THEN 'lab'
    WHEN te.subject_name ~* '\sszem\.$'  THEN 'seminar'
    ELSE 'other'
  END,
  te.teacher_name,
  te.classroom,
  te.day_of_week,
  te.start_time,
  te.end_time,
  te.week_type,
  'scraped',
  md5(concat_ws('|', te.class_id::text, te.subject_name, te.teacher_name,
                te.classroom, te.day_of_week::text,
                te.start_time::text, te.end_time::text, te.week_type)),
  COALESCE(te.scraped_at, NOW()),
  te.edupage_id
FROM timetable_entries te
JOIN courses c
  ON c.norm_name = lower(trim(regexp_replace(te.subject_name, '\s+(e\.a\.|gyak\.|szem\.|lab\.|koll\.)$', '', 'i')))
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Split-slot candidate view (B7a) — where the parity issues LIVE.
--    Lists every slot where one group has 2+ events all marked 'all'.
--    These CANNOT be concluded from the DB alone: resolution is checking each
--    entry's TEACHER timetable in edupage — a biweekly class renders as a
--    half-height cell there, a weekly class fills the cell (user-confirmed).
--    The teachers_to_check column says exactly whose views to fetch.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_split_slot_review AS
SELECT
  cl.name AS group_name,
  e1.day, e1.start_time,
  e1.id AS event_a, ca.name AS course_a, e1.teacher AS teacher_a, e1.room AS room_a,
  e2.id AS event_b, cb.name AS course_b, e2.teacher AS teacher_b, e2.room AS room_b,
  ARRAY_REMOVE(ARRAY[e1.teacher, e2.teacher], NULL) AS teachers_to_check
FROM events e1
JOIN events e2
  ON e1.group_id = e2.group_id
 AND e1.day = e2.day
 AND e1.start_time = e2.start_time
 AND e1.id < e2.id
 AND e1.week_type = 'all'
 AND e2.week_type = 'all'
JOIN classes cl ON cl.id = e1.group_id
JOIN courses ca ON ca.id = e1.course_id
JOIN courses cb ON cb.id = e2.course_id;

-- ---------------------------------------------------------------------------
-- 5) RLS — mirror the existing model (public read for shared data,
--    per-user tables open like user_selections/user_preferences today)
-- ---------------------------------------------------------------------------

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_event_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage their course selection" ON user_course_selection FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage their constraints" ON user_constraints FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage their event preferences" ON user_event_preferences FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — expected:
--   events = 1276 (= timetable_entries), events_without_course = 0,
--   courses ≈ number of distinct base subject names,
--   split_slots > 0 (the known Wed 14:30 cases should appear)
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM timetable_entries)                 AS old_entries,
  (SELECT COUNT(*) FROM events)                            AS events,
  (SELECT COUNT(*) FROM courses)                           AS courses,
  (SELECT COUNT(*) FROM events WHERE course_id IS NULL)    AS events_without_course,
  (SELECT COUNT(*) FROM v_split_slot_review)               AS split_slots_to_review;

-- The interesting one — every split slot with its verdict:
SELECT * FROM v_split_slot_review ORDER BY group_name, day, start_time;

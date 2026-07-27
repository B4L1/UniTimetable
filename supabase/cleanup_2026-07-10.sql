-- UniTimetable data cleanup — 2026-07-10
-- Run in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vnuglyosnikpcagjudid/sql
--
-- Fixes three issues found in the data audit:
--   1. 10 entries where the scraper swapped teacher_name and classroom
--   2. 1 user_preferences row pointing at a stale duplicate class
--   3. 101 stale duplicate classes with zero entries (old scrape generation,
--      numeric edupage ids like "class-46"; the live ones use slugs like
--      "class-informatika-3-b") — these cause empty timetables when picked
--   4. 761 orphan entries (class_id IS NULL, no teacher, no edupage_id) —
--      728 are exact duplicates of class-linked entries; the rest are
--      teacher-less/corrupted and unreachable from normal class selection
--
-- Everything runs in one transaction. Deleted rows are copied into
-- _backup_* tables first; drop those once you're happy (statements at the
-- bottom).

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Backups of everything we delete or modify
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_swapped_entries AS
    SELECT * FROM timetable_entries
    WHERE classroom IN ('Bakó L.', 'Brassai T.', 'Szántó Z.');

CREATE TABLE IF NOT EXISTS _backup_stale_classes AS
    SELECT c.* FROM classes c
    WHERE NOT EXISTS (SELECT 1 FROM timetable_entries t WHERE t.class_id = c.id);

CREATE TABLE IF NOT EXISTS _backup_orphan_entries AS
    SELECT * FROM timetable_entries WHERE class_id IS NULL;

-- ---------------------------------------------------------------------------
-- 1) Un-swap teacher_name <-> classroom (Postgres uses the pre-update values,
--    so a simultaneous swap in one statement is safe)
-- ---------------------------------------------------------------------------
UPDATE timetable_entries
SET teacher_name = classroom,
    classroom    = teacher_name
WHERE classroom IN ('Bakó L.', 'Brassai T.', 'Szántó Z.');

-- ---------------------------------------------------------------------------
-- 2) Remap user_preferences off stale classes onto the live class with the
--    same name (only where exactly one live class has that name)
-- ---------------------------------------------------------------------------
WITH stale AS (
    SELECT c.id, c.name FROM classes c
    WHERE NOT EXISTS (SELECT 1 FROM timetable_entries t WHERE t.class_id = c.id)
),
live AS (
    SELECT c.id, c.name FROM classes c
    WHERE EXISTS (SELECT 1 FROM timetable_entries t WHERE t.class_id = c.id)
),
unique_live AS (
    SELECT name, MIN(id::text)::uuid AS id
    FROM live
    GROUP BY name
    HAVING COUNT(*) = 1
)
UPDATE user_preferences up
SET selected_class_id = ul.id
FROM stale s
JOIN unique_live ul ON ul.name = s.name
WHERE up.selected_class_id = s.id;

-- Any preference still pointing at a stale class (no unique live match):
-- clear it so the FK doesn't block the delete below. (Audit found none,
-- this is belt-and-braces.)
UPDATE user_preferences
SET selected_class_id = NULL
WHERE selected_class_id IN (
    SELECT c.id FROM classes c
    WHERE NOT EXISTS (SELECT 1 FROM timetable_entries t WHERE t.class_id = c.id)
);

-- ---------------------------------------------------------------------------
-- 3) Delete stale classes (zero timetable entries)
-- ---------------------------------------------------------------------------
DELETE FROM classes c
WHERE NOT EXISTS (SELECT 1 FROM timetable_entries t WHERE t.class_id = c.id);

-- ---------------------------------------------------------------------------
-- 4) Delete orphan entries
-- ---------------------------------------------------------------------------
DELETE FROM timetable_entries WHERE class_id IS NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — expected results:
--   timetable_entries = 1276, classes = 73, orphans = 0,
--   entries missing teacher = 0, duplicate class names = 0,
--   teacher-name-as-classroom = 0
-- ---------------------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM timetable_entries)                                   AS entries,
    (SELECT COUNT(*) FROM classes)                                             AS classes,
    (SELECT COUNT(*) FROM timetable_entries WHERE class_id IS NULL)            AS orphans,
    (SELECT COUNT(*) FROM timetable_entries WHERE teacher_name IS NULL)        AS entries_missing_teacher,
    (SELECT COUNT(*) FROM timetable_entries
        WHERE classroom IN ('Bakó L.', 'Brassai T.', 'Szántó Z.'))             AS still_swapped,
    (SELECT COUNT(*) FROM (
        SELECT name FROM classes GROUP BY name HAVING COUNT(*) > 1) d)         AS duplicate_class_names;

-- ---------------------------------------------------------------------------
-- Once verified, remove the backup tables:
-- DROP TABLE IF EXISTS _backup_swapped_entries;
-- DROP TABLE IF EXISTS _backup_stale_classes;
-- DROP TABLE IF EXISTS _backup_orphan_entries;
-- ---------------------------------------------------------------------------

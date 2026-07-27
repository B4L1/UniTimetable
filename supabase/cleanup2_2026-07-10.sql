-- UniTimetable data cleanup, part 2 — 2026-07-10
-- 7 more entries with teacher_name <-> classroom swapped, missed in part 1
-- because the detection regex didn't cover Hungarian digraph initials
-- (Sz., Gy.) or double initials (M.B.):
--   "Hajdú Sz." (3×, Valós idejű rendszerek proj)
--   "Naghi M.B." (2×, Felhasználói felületek tervezése gyak.)
--   "Márton Gy." (2×, Kriptográfia és adatbiztonság)

BEGIN;

UPDATE timetable_entries
SET teacher_name = classroom,
    classroom    = teacher_name
WHERE classroom IN ('Hajdú Sz.', 'Naghi M.B.', 'Márton Gy.');

COMMIT;

-- Verification — expected: 0
SELECT COUNT(*) AS still_swapped
FROM timetable_entries
WHERE classroom IN ('Hajdú Sz.', 'Naghi M.B.', 'Márton Gy.');

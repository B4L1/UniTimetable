// Step 2 — Tárgyak: cohort courses toggled on by default, per-course
// required/optional, external course search (reuses the shared import /
// cross-major API logic).

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    AvailableClassEntry,
    getBaseSubjectName,
    getSubjectColor,
    searchTimetableEntriesBySubject,
} from '@shared/index';
import { buildUnitsFromEntries } from '@shared/lib/generator';
import { useAppStore } from '../../stores/appStore';
import { useWizardStore } from './wizardStore';
import WizardLoader from './WizardLoader';

const TYPE_ORDER: Record<string, number> = { lecture: 0, seminar: 1, lab: 2, other: 3 };

const TYPE_LABEL: Record<string, string> = {
    lecture: 'előadás',
    lab: 'gyakorlat',
    seminar: 'szeminárium',
    other: 'egyéb',
};

interface CourseRow {
    key: string;
    name: string;
    types: { type: string; optionCount: number }[];
    imported: boolean;
}

export default function StepCourses({ pool, loading }: { pool: AvailableClassEntry[]; loading: boolean }) {
    const { importedSubjects, addImportedSubject, removeImportedSubject, selectedClass } = useAppStore();
    const homeClassId = selectedClass?.id;
    const { courseSettings, setCourseSetting, crossMajor, setCrossMajor } = useWizardStore();

    const [query, setQuery] = useState('');
    const [searchState, setSearchState] = useState<{ q: string; entries: AvailableClassEntry[] } | null>(null);

    const trimmedQuery = query.trim();
    const results = useMemo(
        () => (searchState?.q === trimmedQuery ? searchState.entries : []),
        [searchState, trimmedQuery],
    );
    const searching = trimmedQuery.length >= 2 && searchState?.q !== trimmedQuery;

    const courses: CourseRow[] = useMemo(() => {
        // Build units the SAME way the generator does, so the group counts
        // shown here match reality: a lecture shared across groups A/B/C is
        // one option, not three (identical day/time/room/teacher collapse).
        const units = buildUnitsFromEntries(pool, { homeClassId });
        const importedKeys = new Set(importedSubjects.map(getBaseSubjectName));
        const byCourse = new Map<string, CourseRow>();
        for (const u of units) {
            let row = byCourse.get(u.courseKey);
            if (!row) {
                row = { key: u.courseKey, name: u.courseName, types: [], imported: importedKeys.has(u.courseKey) };
                byCourse.set(u.courseKey, row);
            }
            row.types.push({ type: u.type, optionCount: u.options.length });
        }
        for (const row of byCourse.values()) {
            row.types.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));
        }
        return [...byCourse.values()].sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    }, [pool, importedSubjects, homeClassId]);

    // external course search (debounced; all setState happens in callbacks)
    useEffect(() => {
        const q = trimmedQuery;
        const t = setTimeout(() => {
            if (q.length < 2) {
                setSearchState({ q, entries: [] });
                return;
            }
            searchTimetableEntriesBySubject(q)
                .then(entries => setSearchState({ q, entries }));
        }, 300);
        return () => clearTimeout(t);
    }, [trimmedQuery]);

    // group search hits by exact subject_name (that's the import unit)
    const groupedResults = useMemo(() => {
        const seen = new Map<string, { subject: string; classes: string[] }>();
        for (const r of results) {
            let g = seen.get(r.subject_name);
            if (!g) {
                g = { subject: r.subject_name, classes: [] };
                seen.set(r.subject_name, g);
            }
            if (r.class_name && !g.classes.includes(r.class_name)) g.classes.push(r.class_name);
        }
        return Array.from(seen.values()).slice(0, 12);
    }, [results]);

    const settingOf = (key: string) => courseSettings[key] ?? { included: true, optional: false };

    return (
        <section className="wizard-panel">
            <h2>Tárgyak</h2>
            <p className="wizard-hint">
                A csoportod tárgyai alapból bekapcsolva. Kapcsold ki, amit nem veszel fel;
                jelöld opcionálisnak, ami kimaradhat, ha nem fér bele az órarendbe.
            </p>

            <AnimatePresence mode="wait">
            {loading ? (
                <WizardLoader key="loader" label="Tárgyak betöltése…" />
            ) : (
                <motion.ul
                    key="list"
                    className="wizard-course-list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                    {courses.map(course => {
                        const s = settingOf(course.key);
                        return (
                            <li key={course.key} className={`wizard-course${s.included ? '' : ' off'}`}>
                                <span
                                    className="wizard-course-dot"
                                    style={{ background: getSubjectColor(course.name) }}
                                />
                                <div className="wizard-course-main">
                                    <span className="wizard-course-name">
                                        {course.name}
                                        {course.imported && <span className="wizard-tag">importált</span>}
                                    </span>
                                    <span className="wizard-course-meta">
                                        {course.types.map(t => {
                                            const label = TYPE_LABEL[t.type] ?? t.type;
                                            // 1 option = shared/single session; >1 = real group choice
                                            return t.optionCount > 1 ? `${label} (${t.optionCount} csoport)` : label;
                                        }).join(' · ')}
                                    </span>
                                </div>
                                <label className={`wizard-chip${s.optional ? ' active' : ''}`} title="Kimaradhat, ha nem fér bele">
                                    <input
                                        type="checkbox"
                                        checked={s.optional}
                                        onChange={e => setCourseSetting(course.key, { optional: e.target.checked })}
                                    />
                                    opcionális
                                </label>
                                <button
                                    className={`wizard-switch${s.included ? ' on' : ''}`}
                                    role="switch"
                                    aria-checked={s.included}
                                    aria-label={`${course.name} felvétele`}
                                    onClick={() => setCourseSetting(course.key, { included: !s.included })}
                                >
                                    <span className="wizard-switch-knob" />
                                </button>
                            </li>
                        );
                    })}
                    {courses.length === 0 && (
                        <li className="wizard-empty">Nincs elérhető tárgy ehhez a csoporthoz.</li>
                    )}
                </motion.ul>
            )}
            </AnimatePresence>

            <div className="wizard-subsection">
                <h3>Külső tárgy hozzáadása</h3>
                <label className="wizard-checkbox">
                    <input
                        type="checkbox"
                        checked={crossMajor}
                        onChange={e => setCrossMajor(e.target.checked)}
                    />
                    Bővített keresés — a tárgyaim más szakos csoportjai is választhatók
                </label>
                <input
                    type="search"
                    className="wizard-input"
                    placeholder="Tárgy keresése minden szakon… (min. 2 betű)"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                {searching && <div className="wizard-loading">Keresés…</div>}
                {groupedResults.length > 0 && (
                    <ul className="wizard-search-results">
                        {groupedResults.map(g => {
                            const already = importedSubjects.includes(g.subject);
                            return (
                                <li key={g.subject}>
                                    <div className="wizard-course-main">
                                        <span className="wizard-course-name">{g.subject}</span>
                                        <span className="wizard-course-meta">{g.classes.join(', ')}</span>
                                    </div>
                                    <button
                                        className="btn wizard-btn-secondary wizard-btn-small"
                                        disabled={already}
                                        onClick={() => addImportedSubject(g.subject)}
                                    >
                                        {already ? 'Hozzáadva' : '+ Hozzáadás'}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {importedSubjects.length > 0 && (
                    <div className="wizard-imported">
                        {importedSubjects.map(s => (
                            <span key={s} className="wizard-tag wizard-tag-removable">
                                {s}
                                <button aria-label={`${s} eltávolítása`} onClick={() => removeImportedSubject(s)}>×</button>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

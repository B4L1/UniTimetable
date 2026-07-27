// Step 5 — Véglegesítés + finomhangolás (spec §A13 smart editing):
// review the picked schedule, lock/exclude individual classes, drag between
// valid alternatives, re-optimise ("Javítás"), then save into the existing
// user_selections flow (event ids ARE entry ids, preserved by Phase 2).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AvailableClassEntry,
    getBaseSubjectName,
    setUserEventPreference,
} from '@shared/index';
import {
    buildUnitsFromEntries,
    generateSchedules,
    timeToMinutes,
    GenerationIssue,
} from '@shared/lib/generator';
import { useAppStore } from '../../stores/appStore';
import { useWizardStore } from './wizardStore';
import ScheduleGrid from './ScheduleGrid';

export default function StepEdit({ pool }: { pool: AvailableClassEntry[]; loading: boolean }) {
    const navigate = useNavigate();
    const { setSelections, user, selectedClass } = useAppStore();
    const homeClassId = selectedClass?.id;
    const {
        pickedEventIds, pickedExplanation, setStep, clearPicked, updatePicked,
        lockedEventIds, excludedEventIds, toggleLock, toggleExclude,
        courseSettings, allowedDays, earliestStart, latestEnd, wGaps, wEarly, wDays,
    } = useWizardStore();

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [improveIssues, setImproveIssues] = useState<GenerationIssue[]>([]);
    const [improvedNote, setImprovedNote] = useState<string | null>(null);

    const byId = useMemo(() => new Map(pool.map(e => [e.id, e])), [pool]);

    const entries = useMemo(() => {
        if (!pickedEventIds) return [];
        return pickedEventIds
            .map(id => byId.get(id))
            .filter((e): e is AvailableClassEntry => !!e)
            .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
    }, [pickedEventIds, byId]);

    if (!pickedEventIds) {
        return (
            <section className="wizard-panel">
                <h2>Véglegesítés</h2>
                <p className="wizard-hint">Még nem választottál órarendet.</p>
                <button className="btn btn-primary" onClick={() => setStep(3)}>
                    Vissza a generáláshoz
                </button>
            </section>
        );
    }

    // saving invalidates once you edit again
    const invalidate = () => { setSaved(false); setImprovedNote(null); };

    const writeThrough = (id: string) => {
        if (!user) return;
        const s = useWizardStore.getState();
        setUserEventPreference(user.email, id, {
            locked: s.lockedEventIds.includes(id),
            excluded: s.excludedEventIds.includes(id),
        });
    };

    const onToggleLock = (id: string) => { toggleLock(id); writeThrough(id); invalidate(); };
    const onToggleExclude = (id: string) => { toggleExclude(id); writeThrough(id); invalidate(); };

    /** Re-run the generator honouring the current locks/exclusions (§A13). */
    const improve = () => {
        const allKeys = new Set(pool.map(e => getBaseSubjectName(e.subject_name)));
        const includedCourses = [...allKeys].filter(k => courseSettings[k]?.included !== false);
        const optionalCourses = includedCourses.filter(k => courseSettings[k]?.optional === true);
        const units = buildUnitsFromEntries(pool, { includedCourses, optionalCourses, homeClassId });
        const res = generateSchedules(units, {
            allowedDays,
            earliestStartMin: timeToMinutes(earliestStart),
            latestEndMin: timeToMinutes(latestEnd),
            weights: { gapHour: wGaps, earlyClass: wEarly, dayUsed: wDays },
            lockedEventIds,
            excludedEventIds,
        });
        if (res.schedules.length > 0) {
            const best = res.schedules[0];
            const changed = best.eventIds.length !== pickedEventIds.length ||
                best.eventIds.some(id => !pickedEventIds.includes(id));
            updatePicked(best.eventIds, best.explanation);
            setImproveIssues([]);
            setImprovedNote(changed ? 'Frissített órarend a rögzítések és kizárások szerint.' : 'Ez már a legjobb a jelenlegi beállításokkal.');
            setSaved(false);
        } else {
            setImproveIssues(res.issues);
            setImprovedNote(null);
        }
    };

    /** Drag swapped a course to a different group → new event id set. */
    const onSwapOption = (removeIds: string[], addIds: string[]) => {
        const next = pickedEventIds.filter(id => !removeIds.includes(id)).concat(addIds);
        const seen = new Set(next);
        updatePicked([...seen], pickedExplanation ?? '');
        invalidate();
    };

    const save = async () => {
        setSaving(true);
        try {
            await setSelections(pickedEventIds);
            setSaved(true);
        } finally {
            setSaving(false);
        }
    };

    const lockedSet = new Set(lockedEventIds);
    const excludedSet = new Set(excludedEventIds);
    const excludedInSchedule = entries.filter(e => excludedSet.has(e.id)).length;
    const dayCount = new Set(entries.map(e => e.day_of_week)).size;

    return (
        <section className="wizard-panel wizard-panel-edit">
            <div className="wizard-edit-head">
                <h2>Kész órarend</h2>
                <div className="wizard-stat-chips">
                    <span className="wizard-stat"><b>{dayCount}</b> nap</span>
                    <span className="wizard-stat"><b>{entries.length}</b> óra</span>
                </div>
            </div>

            {/* grid fills the available space first, no scroll */}
            <ScheduleGrid
                pool={pool}
                pickedEventIds={pickedEventIds}
                lockedSet={lockedSet}
                excludedSet={excludedSet}
                courseSettings={courseSettings}
                homeClassId={homeClassId}
                onToggleLock={onToggleLock}
                onToggleExclude={onToggleExclude}
                onSwapOption={onSwapOption}
            />

            {/* guide + status + actions sit below the grid */}
            <div className="wizard-edit-foot">
                {excludedInSchedule > 0 && (
                    <p className="wizard-warning">
                        {excludedInSchedule} kizárt óra még az órarendben van — a Javítás lecseréli őket.
                    </p>
                )}
                {improveIssues.length > 0 && (
                    <div className="wizard-issue">
                        <p>Nem sikerült ütközésmentes órarendet találni a jelenlegi rögzítésekkel/kizárásokkal:</p>
                        <ul>{improveIssues.map((iss, i) => <li key={i}>{iss.message}</li>)}</ul>
                    </div>
                )}
                {improvedNote && <p className="wizard-hint">{improvedNote}</p>}
                {entries.length < pickedEventIds.length && (
                    <p className="wizard-warning">
                        Néhány óra nem található a jelenlegi tárgylistában — generáld újra az órarendet.
                    </p>
                )}

                <div className="wizard-legend">
                    <span className="wizard-legend-item">
                        <span className="wizard-legend-icon">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>
                        </span>
                        rögzítés
                    </span>
                    <span className="wizard-legend-item">
                        <span className="wizard-legend-icon">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </span>
                        kizárás
                    </span>
                    <span className="wizard-legend-item"><span className="wizard-legend-swatch free" /> szabad hely</span>
                    <span className="wizard-legend-item"><span className="wizard-legend-swatch conflict" /> ütközik</span>
                    <span className="wizard-legend-item">— húzd egy másik csoport helyére</span>
                </div>

                <div className="wizard-nav-row">
                    <button className="btn wizard-btn-secondary" onClick={() => { clearPicked(); setStep(3); }}>
                        Másikat választok
                    </button>
                    <div className="wizard-row">
                        <button className="btn wizard-btn-secondary" onClick={improve}>
                            Javítás
                        </button>
                        <button className="btn btn-primary" onClick={save} disabled={saving || saved}>
                            {saving ? 'Mentés…' : saved ? 'Elmentve ✓' : 'Mentés az órarendembe'}
                        </button>
                        {saved && (
                            <button className="btn wizard-btn-secondary" onClick={() => navigate('/')}>
                                Órarend megtekintése
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

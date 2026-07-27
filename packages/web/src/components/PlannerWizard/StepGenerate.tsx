// Step 4 — Generálás: run the Phase 3 generator, show 3–5 schedule cards
// with mini-preview + explanation (spec §A9/§A12), surface constraint
// violations with actionable resolutions (§A15).

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    AvailableClassEntry,
    getBaseSubjectName,
} from '@shared/index';
import {
    buildUnitsFromEntries,
    generateSchedules,
    timeToMinutes,
    GenerationIssue,
    IssueResolution,
} from '@shared/lib/generator';
import { useAppStore } from '../../stores/appStore';
import { useWizardStore, WizardStep } from './wizardStore';
import MiniPreview from './MiniPreview';
import WizardLoader from './WizardLoader';

const RESOLUTION_ACTIONS: Partial<Record<IssueResolution, { label: string; step: WizardStep }>> = {
    'allow-day': { label: 'Napok módosítása', step: 2 },
    'widen-time-window': { label: 'Idősáv bővítése', step: 2 },
    'make-optional': { label: 'Opcionálissá tétel', step: 1 },
    'remove-course': { label: 'Tárgy kikapcsolása', step: 1 },
    'restore-excluded': { label: 'Kizárások kezelése', step: 1 },
    'unlock-event': { label: 'Rögzítések kezelése', step: 1 },
};

function IssueCard({ issue }: { issue: GenerationIssue }) {
    const setStep = useWizardStore(s => s.setStep);
    return (
        <div className="wizard-issue">
            <p>{issue.message}</p>
            <div className="wizard-row">
                {issue.resolutions.map(r => {
                    const action = RESOLUTION_ACTIONS[r];
                    return action ? (
                        <button
                            key={r}
                            className="btn wizard-btn-secondary wizard-btn-small"
                            onClick={() => setStep(action.step)}
                        >
                            {action.label}
                        </button>
                    ) : null;
                })}
            </div>
        </div>
    );
}

export default function StepGenerate({ pool, loading }: { pool: AvailableClassEntry[]; loading: boolean }) {
    const homeClassId = useAppStore(s => s.selectedClass?.id);
    const {
        courseSettings, allowedDays, earliestStart, latestEnd,
        wGaps, wEarly, wDays, pickSchedule,
        genResult, genMeta, genInputSig, setGeneration,
    } = useWizardStore();

    const [running, setRunning] = useState(false);
    const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (runTimer.current) clearTimeout(runTimer.current);
    }, []);

    const entryById = useMemo(
        () => new Map(pool.map(e => [e.id, e])),
        [pool],
    );

    // Signature of everything that would change the result — so we can tell
    // the user their remembered results are stale after they tweak settings.
    const inputSig = useMemo(() => {
        const allKeys = new Set(pool.map(e => getBaseSubjectName(e.subject_name)));
        const included = [...allKeys].filter(k => courseSettings[k]?.included !== false).sort();
        const optional = included.filter(k => courseSettings[k]?.optional === true);
        return JSON.stringify({
            included, optional, allowedDays, earliestStart, latestEnd,
            wGaps, wEarly, wDays, homeClassId, poolSize: pool.length,
        });
    }, [pool, courseSettings, allowedDays, earliestStart, latestEnd, wGaps, wEarly, wDays, homeClassId]);

    const result = genResult;
    const stale = !!result && genInputSig !== null && genInputSig !== inputSig;

    const run = () => {
        if (running) return;
        setRunning(true);
        // the solver itself finishes in well under a second — the short delay
        // gives the loader animation one full pulse so the run feels tangible
        runTimer.current = setTimeout(() => {
            const allKeys = new Set(pool.map(e => getBaseSubjectName(e.subject_name)));
            const includedCourses = Array.from(allKeys)
                .filter(k => courseSettings[k]?.included !== false);
            const optionalCourses = includedCourses
                .filter(k => courseSettings[k]?.optional === true);

            const units = buildUnitsFromEntries(pool, { includedCourses, optionalCourses, homeClassId });
            const t0 = performance.now();
            const res = generateSchedules(units, {
                allowedDays,
                earliestStartMin: timeToMinutes(earliestStart),
                latestEndMin: timeToMinutes(latestEnd),
                weights: { gapHour: wGaps, earlyClass: wEarly, dayUsed: wDays },
            });
            setGeneration(res, { combos: res.combosEvaluated, ms: performance.now() - t0, truncated: res.truncated }, inputSig);
            setRunning(false);
        }, 650);
    };

    return (
        <section className="wizard-panel">
            <h2>Generálás</h2>
            <p className="wizard-hint">
                A generátor az összes ütközésmentes csoportkombinációt pontozza
                (lyukasórák, korai kezdések, bejárós napok — páros/páratlan hetekre külön),
                és a legjobb 5-öt mutatja.
            </p>

            <div className="wizard-row">
                <button className="btn btn-primary" onClick={run} disabled={loading || running || pool.length === 0}>
                    {running ? 'Generálás…' : result ? 'Újragenerálás' : 'Órarendek generálása'}
                </button>
                {genMeta && result && (
                    <span className="wizard-course-meta tnum">
                        {genMeta.combos.toLocaleString('hu')} kombináció · {genMeta.ms.toFixed(0)} ms
                        {genMeta.truncated ? ' · levágva (túl sok kombináció)' : ''}
                    </span>
                )}
            </div>

            {stale && !running && (
                <p className="wizard-warning">
                    A beállítások változtak a generálás óta — generálj újra a friss eredményekért.
                </p>
            )}

            <AnimatePresence>
                {(loading || running) && (
                    <WizardLoader
                        key="gen-loader"
                        label={running ? 'Kombinációk pontozása…' : 'Tárgyak betöltése…'}
                    />
                )}
            </AnimatePresence>

            {result?.issues.map((issue, i) => <IssueCard key={i} issue={issue} />)}

            <div className="wizard-schedules">
                {result?.schedules.map((s, rank) => {
                    const entries = s.eventIds
                        .map(id => entryById.get(id))
                        .filter((e): e is AvailableClassEntry => !!e);
                    const pick = () => pickSchedule(s.eventIds, s.explanation);
                    return (
                        <motion.article
                            key={s.eventIds.join('+')}
                            className={`wizard-schedule-card clickable${rank === 0 ? ' best' : ''}`}
                            role="button"
                            tabIndex={0}
                            aria-label={`${rank + 1}. órarend kiválasztása`}
                            onClick={pick}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
                            }}
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileTap={{ scale: 0.985 }}
                            transition={{
                                type: 'spring',
                                stiffness: 380,
                                damping: 30,
                                delay: rank * 0.07,
                            }}
                        >
                            <header>
                                <span className="wizard-schedule-rank">{rank + 1}.</span>
                                {rank === 0 && <span className="wizard-tag">legjobb</span>}
                                <span className="wizard-schedule-pick">Kiválasztom →</span>
                            </header>
                            <MiniPreview entries={entries} />
                            <p className="wizard-schedule-explanation">{s.explanation}</p>
                        </motion.article>
                    );
                })}
            </div>
        </section>
    );
}

// Planner stepper (SPEC_V3_PLAN.md Phase 4, spec §A9):
// Profil → Tárgyak → Preferenciák → Generálás → Véglegesítés.
// Rendered as a modal dialog over the timetable (glass is allowed on modals
// per §A5). Runs alongside the old Planner until Phase 5 parity (Part E #4).

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
    fetchAvailableClassesForPlanner,
    fetchUserEventPreferences,
    AvailableClassEntry,
} from '@shared/index';
import { useAppStore } from '../../stores/appStore';
import { useWizardStore, WIZARD_STEPS, WizardStep } from './wizardStore';
import StepProfile from './StepProfile';
import StepCourses from './StepCourses';
import StepPreferences from './StepPreferences';
import StepGenerate from './StepGenerate';
import StepEdit from './StepEdit';
import './PlannerWizard.css';

export default function PlannerWizard() {
    const navigate = useNavigate();
    const { selectedClass, importedSubjects, customEntries, user } = useAppStore();
    const { step, setStep, crossMajor, courseSettings, setEventPrefs } = useWizardStore();

    const close = () => navigate('/');

    // Load lock/exclude prefs (spec §A13) — the table is authoritative.
    useEffect(() => {
        if (!user?.email) return;
        let cancelled = false;
        fetchUserEventPreferences(user.email).then(({ locked, excluded }) => {
            if (!cancelled) setEventPrefs(locked, excluded);
        });
        return () => { cancelled = true; };
    }, [user?.email, setEventPrefs]);

    // Esc closes the modal, like ClassDetailModal
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') navigate('/');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navigate]);

    // One option pool for every step: the cohort + imported subjects
    // (+ cross-major alternatives when enabled). Loading is derived by
    // comparing the stored pool's input key with the current one.
    const poolKey = useMemo(
        () => `${selectedClass?.id ?? ''}|${crossMajor}|${importedSubjects.join('§')}`,
        [selectedClass?.id, crossMajor, importedSubjects],
    );
    const [poolState, setPoolState] = useState<{ key: string; entries: AvailableClassEntry[] } | null>(null);

    useEffect(() => {
        if (!selectedClass?.id) return;
        let cancelled = false;
        fetchAvailableClassesForPlanner(selectedClass.id, importedSubjects, crossMajor)
            .then(entries => {
                if (cancelled) return;
                // A transient fetch failure returns [] (the api swallows errors).
                // Don't let an empty result wipe an already-loaded pool — that
                // would blank the schedule mid-edit.
                setPoolState(prev =>
                    (entries.length === 0 && prev && prev.entries.length > 0)
                        ? prev
                        : { key: poolKey, entries });
            });
        return () => { cancelled = true; };
    }, [poolKey, selectedClass?.id, importedSubjects, crossMajor]);

    const pool = useMemo(
        () => (poolState?.key === poolKey ? poolState.entries : []),
        [poolState, poolKey],
    );
    const loading = !!selectedClass?.id && poolState?.key !== poolKey;

    // The Planner's manual week-type overrides apply everywhere (Phase 1
    // decision) — the generator must see the corrected parities too.
    const effectivePool = useMemo(
        () => pool.map(e =>
            customEntries[e.id]?.week_type
                ? { ...e, week_type: customEntries[e.id].week_type! }
                : e),
        [pool, customEntries],
    );

    const includedCourseCount = useMemo(() => {
        const keys = new Set<string>();
        for (const e of effectivePool) {
            const key = e.subject_name; // counted properly in StepCourses; here just non-empty check
            keys.add(key);
        }
        return keys.size;
    }, [effectivePool]);

    const canAdvanceFrom = (s: WizardStep): boolean => {
        if (s === 0) return !!selectedClass;
        if (s === 1) {
            // at least one course still included
            return includedCourseCount > 0 &&
                Object.values(courseSettings).filter(c => !c.included).length < includedCourseCount;
        }
        return true;
    };

    const goTo = (target: WizardStep) => {
        if (target > step && !canAdvanceFrom(step)) return;
        setStep(target);
    };

    const stepProps = { pool: effectivePool, loading };

    return (
        <motion.div
            className="wizard-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
        >
            <motion.div
                className="wizard-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Órarend generáló"
                initial={{ opacity: 0, scale: 0.94, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                onClick={e => e.stopPropagation()}
            >
                <header className="wizard-modal-header">
                    <nav className="wizard-steps" aria-label="Tervező lépések">
                        {WIZARD_STEPS.map((label, i) => (
                            <button
                                key={label}
                                className={`wizard-step-chip${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
                                onClick={() => goTo(i as WizardStep)}
                                disabled={i > step + 1}
                            >
                                <span className="wizard-step-num">{i + 1}</span>
                                <span className="wizard-step-label">{label}</span>
                            </button>
                        ))}
                    </nav>
                    <button className="wizard-close" onClick={close} aria-label="Bezárás">✕</button>
                </header>

                <div className="wizard-modal-body">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            className="wizard-step-wrap"
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -24 }}
                            transition={{ duration: 0.16, ease: 'easeOut' }}
                        >
                            {step === 0 && <StepProfile />}
                            {step === 1 && <StepCourses {...stepProps} />}
                            {step === 2 && <StepPreferences {...stepProps} />}
                            {step === 3 && <StepGenerate {...stepProps} />}
                            {step === 4 && <StepEdit {...stepProps} />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <footer className="wizard-nav">
                    <button
                        className="btn wizard-btn-secondary"
                        onClick={() => goTo(Math.max(0, step - 1) as WizardStep)}
                        disabled={step === 0}
                    >
                        Vissza
                    </button>
                    {step < 4 && (
                        <button
                            className="btn btn-primary"
                            onClick={() => goTo(Math.min(4, step + 1) as WizardStep)}
                            disabled={!canAdvanceFrom(step)}
                        >
                            Tovább
                        </button>
                    )}
                </footer>
            </motion.div>
        </motion.div>
    );
}

// Step 3 — Preferenciák: allowed days (hard), time window (hard),
// three question-style importance sliders (soft, spec §A9/§A11).
// The 0–3 slider value IS the generator weight; the UI shows it as words.

import { useMemo } from 'react';
import { AvailableClassEntry, getBaseSubjectName } from '@shared/index';
import { useWizardStore } from './wizardStore';

const DAY_LABELS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

const START_TIMES = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00'];
const END_TIMES = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '20:30', '21:00'];

const BOTHER_LEVELS = ['Egyáltalán nem', 'Kicsit', 'Közepesen', 'Nagyon'];
const IMPORTANCE_LEVELS = ['Nem fontos', 'Kicsit fontos', 'Fontos', 'Nagyon fontos'];

interface QuestionSliderProps {
    question: string;
    hint: string;
    levels: string[];
    value: number;
    onChange: (v: number) => void;
}

function QuestionSlider({ question, hint, levels, value, onChange }: QuestionSliderProps) {
    // legacy persisted values can be fractional (e.g. 1.5) — snap for display
    const level = Math.min(levels.length - 1, Math.max(0, Math.round(value)));
    return (
        <label className="wizard-slider-row">
            <div className="wizard-slider-text">
                <span>{question}</span>
                <span className="wizard-course-meta">{hint}</span>
            </div>
            <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={level}
                onChange={e => onChange(Number(e.target.value))}
                aria-label={question}
                aria-valuetext={levels[level]}
            />
            <span className="wizard-slider-value">{levels[level]}</span>
        </label>
    );
}

export default function StepPreferences({ pool }: { pool: AvailableClassEntry[]; loading: boolean }) {
    const {
        allowedDays, setAllowedDays,
        earliestStart, latestEnd, setTimeWindow,
        wGaps, wEarly, wDays, setWeights,
        courseSettings,
    } = useWizardStore();

    // Szombat only shows up when an INCLUDED course actually has Saturday
    // classes — an excluded course's Saturday slot shouldn't add a day chip.
    const hasSaturday = useMemo(
        () => pool.some(e =>
            e.day_of_week === 5 &&
            courseSettings[getBaseSubjectName(e.subject_name)]?.included !== false),
        [pool, courseSettings],
    );
    const dayCount = hasSaturday ? 6 : 5;

    const toggleDay = (day: number) => {
        setAllowedDays(
            allowedDays.includes(day)
                ? allowedDays.filter(d => d !== day)
                : [...allowedDays, day].sort(),
        );
    };

    return (
        <section className="wizard-panel">
            <h2>Preferenciák</h2>
            <p className="wizard-hint">
                A napok és az idősáv kemény feltételek — ami kívül esik, be sem kerül.
                A kérdések a rangsorolást hangolják: amit jobban kerülnél, azt a
                generátor drágábban „vásárolja meg".
            </p>

            <div className="wizard-subsection">
                <h3>Engedélyezett napok</h3>
                <div className="wizard-days">
                    {Array.from({ length: dayCount }, (_, d) => (
                        <label key={d} className={`wizard-day-chip${allowedDays.includes(d) ? ' active' : ''}`}>
                            <input
                                type="checkbox"
                                checked={allowedDays.includes(d)}
                                onChange={() => toggleDay(d)}
                            />
                            {DAY_LABELS[d]}
                        </label>
                    ))}
                </div>
                {allowedDays.length === 0 && (
                    <p className="wizard-warning">Legalább egy napot engedélyezz.</p>
                )}
            </div>

            <div className="wizard-subsection">
                <h3>Idősáv</h3>
                <div className="wizard-row">
                    <label className="wizard-field">
                        Legkorábbi kezdés
                        <select
                            className="wizard-input"
                            value={earliestStart}
                            onChange={e => setTimeWindow(e.target.value, latestEnd)}
                        >
                            {START_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </label>
                    <label className="wizard-field">
                        Legkésőbbi befejezés
                        <select
                            className="wizard-input"
                            value={latestEnd}
                            onChange={e => setTimeWindow(earliestStart, e.target.value)}
                        >
                            {END_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            <div className="wizard-subsection">
                <h3>Mi számít neked?</h3>
                <QuestionSlider
                    question="Mennyire zavarnak a lyukasórák?"
                    hint="üres sávok két óra között ugyanazon a napon"
                    levels={BOTHER_LEVELS}
                    value={wGaps}
                    onChange={v => setWeights({ wGaps: v })}
                />
                <QuestionSlider
                    question="Mennyire zavarnak a korai órák?"
                    hint="10:00 előtt kezdődő órák"
                    levels={BOTHER_LEVELS}
                    value={wEarly}
                    onChange={v => setWeights({ wEarly: v })}
                />
                <QuestionSlider
                    question="Mennyire fontos, hogy kevesebb napot járj be?"
                    hint="a szabadnapok száma a héten"
                    levels={IMPORTANCE_LEVELS}
                    value={wDays}
                    onChange={v => setWeights({ wDays: v })}
                />
            </div>
        </section>
    );
}

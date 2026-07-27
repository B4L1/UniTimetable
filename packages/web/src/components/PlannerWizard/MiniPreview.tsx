// Tiny week-grid preview for generated schedule cards. Odd-week events sit
// in the left half of the day column, even-week in the right, every-week
// spans the whole column — the same parity language as the main grid.

import { useMemo } from 'react';
import { AvailableClassEntry, getSubjectColor } from '@shared/index';
import { timeToMinutes } from '@shared/lib/generator';

const DAY_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const START = 8 * 60;
const END = 20.5 * 60;

export default function MiniPreview({ entries }: { entries: AvailableClassEntry[] }) {
    const dayCount = useMemo(
        () => entries.some(e => e.day_of_week === 5) ? 6 : 5,
        [entries],
    );

    return (
        <div className="wizard-minigrid" style={{ gridTemplateColumns: `repeat(${dayCount}, 1fr)` }}>
            {Array.from({ length: dayCount }, (_, day) => (
                <div key={day} className="wizard-minigrid-day">
                    <span className="wizard-minigrid-label">{DAY_SHORT[day]}</span>
                    <div className="wizard-minigrid-col">
                        {entries.filter(e => e.day_of_week === day).map(e => {
                            const start = timeToMinutes(e.start_time);
                            const end = timeToMinutes(e.end_time);
                            const top = Math.max(0, ((start - START) / (END - START)) * 100);
                            const height = Math.max(3, ((end - start) / (END - START)) * 100);
                            const parity = e.week_type;
                            return (
                                <span
                                    key={e.id}
                                    className={`wizard-minigrid-block parity-${parity}`}
                                    style={{
                                        top: `${top}%`,
                                        height: `${height}%`,
                                        background: getSubjectColor(e.subject_name),
                                    }}
                                    title={`${e.subject_name} · ${e.start_time.slice(0, 5)}–${e.end_time.slice(0, 5)}${parity !== 'all' ? ` (${parity === 'odd' ? 'páratlan' : 'páros'} hét)` : ''}`}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// Timetable component for web

import { useEffect, useMemo, useState, useRef, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../stores/appStore';
import { webStorage } from '../stores/webStorage';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
    fetchTimetableEntries, fetchTimetableEntriesByIds, fetchTeacherTimetable, assignSubjectColors,
    TIME_SLOTS, DAY_NAMES, computeSlotSpan, timeToMinutes as getMinutes, generateICS,
} from '@shared/index';
import { showToast } from '../stores/toastStore';
import type { AvailableClassEntry } from '@shared/lib/api';
import type { TimetableEntry } from '@shared/lib/types';
import ClassCard from './ClassCard';
import ClassDetailModal from './ClassDetailModal';
import { revealGrid } from '../motion';

// Saturday (index 5) exists in edupage data for some programs; the grid only
// shows it when the displayed timetable actually has a Saturday class.
const DAYS = DAY_NAMES;

import { getAcademicWeek } from '../utils/calendar';

interface TimetableProps {
    onExportRef?: React.MutableRefObject<(() => Promise<void>) | null>;
    onExportIcsRef?: React.MutableRefObject<(() => void) | null>;
}

export default function Timetable({ onExportRef, onExportIcsRef }: TimetableProps = {}) {
    const { selectedClass, selectedTeacher, timetableEntries, setTimetableEntries, userSelections, isLoading, preferences, customEntries } = useAppStore();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const gridRef = useRef<HTMLDivElement>(null);

    // Desktop viewport tiers (spec §2.4–2.5): shrink typography before ever
    // allowing scroll; below a usable minimum show a fallback message.
    const containerRef = useRef<HTMLDivElement>(null);
    const [sizeTier, setSizeTier] = useState<'normal' | 'compact' | 'too-small'>('normal');
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            const h = entries[0].contentRect.height;
            setSizeTier(h < 340 ? 'too-small' : h < 560 ? 'compact' : 'normal');
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [isMobile]);

    // Track current time
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Initial set
        setCurrentTime(new Date());

        // Update every minute
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    // Determine current week type based on settings or auto-calculation
    const academicWeek = useMemo(() => getAcademicWeek(), []);
    const currentWeekType = useMemo(() => {
        const calculatedWeek = academicWeek.type;
        if (preferences.invertWeekParity && (calculatedWeek === 'odd' || calculatedWeek === 'even')) {
            return calculatedWeek === 'odd' ? 'even' : 'odd';
        }
        return calculatedWeek;
    }, [preferences.invertWeekParity, academicWeek]);

    const today = new Date().getDay() - 1; // 0 = Monday

    // State for user-selected entries
    const [userSelectedEntries, setUserSelectedEntries] = useState<AvailableClassEntry[]>([]);
    const [loadingSelections, setLoadingSelections] = useState(false);

    // Always fetch original timetable entries for the base schedule
    useEffect(() => {
        if (selectedClass?.id) {
            fetchTimetableEntries(selectedClass.id).then(entries => {
                if (entries.length > 0) setTimetableEntries(entries);
            });
        } else if (selectedTeacher?.id) {
            fetchTeacherTimetable(selectedTeacher.id).then(entries => {
                if (entries.length > 0) setTimetableEntries(entries);
            });
        }
    }, [selectedClass?.id, selectedTeacher?.id]);

    // Fetch user-selected entries when there are selections
    useEffect(() => {
        if (userSelections.length > 0) {
            setLoadingSelections(true);
            fetchTimetableEntriesByIds(userSelections)
                .then(async entries => {
                    if (entries.length > 0) {
                        setUserSelectedEntries(entries);
                        await webStorage.setSelectedEntriesCache(entries);
                    } else {
                        // Fetch returned empty — likely offline. Fall back to cache.
                        const cached = await webStorage.getSelectedEntriesCache();
                        if (cached && cached.length > 0) {
                            setUserSelectedEntries(cached);
                        }
                    }
                })
                .finally(() => setLoadingSelections(false));
        } else {
            setUserSelectedEntries([]);
        }
    }, [userSelections]);

    // Deterministic subject colors: assign from the full (sorted) subject set.
    // v3: one muted palette for all themes, so this only depends on the data.
    useEffect(() => {
        const names = [...timetableEntries, ...userSelectedEntries].map(e => e.subject_name);
        if (names.length > 0) assignSubjectColors(names);
    }, [timetableEntries, userSelectedEntries]);

    // Saturday column only when the displayed data needs it
    const hasSaturday = useMemo(
        () => [...timetableEntries, ...userSelectedEntries].some(e => e.day_of_week === 5),
        [timetableEntries, userSelectedEntries]
    );
    const visibleDays = hasSaturday ? DAYS : DAYS.slice(0, 5);
    const dayCount = visibleDays.length;

    // Class detail window (tap a card to open; desktop cards morph via layoutId)
    const [detailEntry, setDetailEntry] = useState<AvailableClassEntry | null>(null);

    // Mobile Carousel State
    const [currentDayIndex, setCurrentDayIndex] = useState(today >= 0 && today < 5 ? today : 0);
    const [direction, setDirection] = useState(0);

    // If today is a Saturday with classes, land on it once the data loads
    useEffect(() => {
        if (hasSaturday && today === 5) setCurrentDayIndex(5);
    }, [hasSaturday, today]);

    const paginate = (newDirection: number) => {
        setDirection(newDirection);
        setCurrentDayIndex(prev => {
            const next = prev + newDirection;
            if (next > dayCount - 1) return 0;
            if (next < 0) return dayCount - 1;
            return next;
        });
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0
        })
    };

    // Combine original entries + user selections
    // Strategy: User selections OVERRIDE original entries in the same time slot
    const entriesToDisplay = useMemo(() => {
        if (userSelections.length === 0) {
            return timetableEntries;
        }

        // 1. Start with user selections (imports + planner choices)
        const entries = [...userSelectedEntries];

        // 2. Add original entries ONLY if there's no conflict in that slot
        // However, if the user has confirmed selections in the planner, usually that implies
        // they want ONLY those selections for those slots.
        // But for "Subject Import", we just added IDs to userSelections list.
        // The problem is distinguishing "Original class I want to keep" vs "Original class I replaced".

        // If we are in "Planner Mode" (userSelections > 0), we treat userSelections as the source of truth.
        // BUT, when importing subjects, we wanted to KEEP original classes. 
        // Checks Settings.tsx -> we do `const mergedSelections = [...baseSelections, ...newIds]`.
        // This means `userSelections` SHOULD contain the original class IDs too if we did it right.

        // If `userSelections` contains everything, we just show `userSelectedEntries`.
        // If `userSelectedEntries` is missing original classes, it means `userSelections` was not properly seeded.

        return userSelectedEntries;
    }, [userSelections.length, userSelectedEntries, timetableEntries]);

    // Filter entries for current week.
    // Manual week-type overrides from the Planner (customEntries) are applied
    // first — the scraper marks some alternating group-split labs as 'all',
    // and the user's correction must win here, not just in the Planner view.
    const filteredEntries = useMemo(() => {
        // Source is either user selections (if any) or default entries
        const source = userSelections.length > 0 ? userSelectedEntries : timetableEntries;

        return source
            .map(entry => {
                const override = customEntries[entry.id]?.week_type;
                return override && override !== entry.week_type
                    ? { ...entry, week_type: override }
                    : entry;
            })
            .filter(entry => entry.week_type === 'all' || entry.week_type === currentWeekType);
    }, [userSelections.length, userSelectedEntries, timetableEntries, currentWeekType, customEntries]);

    // Image export — delegate to export module
    const handleExportImage = useCallback(async () => {
        try {
            const weekLabel = 'Páros és páratlan hét';
            const dateStr = new Date().toLocaleDateString('hu-HU',
                { year: 'numeric', month: 'long', day: 'numeric' });
            const exportTitle = selectedClass?.name || selectedTeacher?.name || 'UniTimetable';
            const fileName = `${exportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;

            // Lazy: keeps the export module's canvas-drawing code out of the
            // initial bundle (perf budget B10) even though it's now small.
            const { exportTimetableImage } = await import('../export');
            await exportTimetableImage({
                entries: entriesToDisplay,
                title: exportTitle,
                weekLabel,
                dateLabel: dateStr,
                selectedClassId: selectedClass?.id,
                downloadFileName: fileName,
            });
        } catch (err) {
            console.error('Export failed:', err);
            showToast('A kép exportálása nem sikerült.', 'error');
        }
    }, [selectedClass, selectedTeacher, entriesToDisplay]);

    // Calendar export — turns the timetable into recurring events a real
    // calendar app can subscribe to. Unlike the PNG (a snapshot of the
    // currently-viewed week), this covers the whole fortnight: entriesToDisplay
    // already carries both odd/even variants, and generateICS's own RRULE
    // handles the alternation, so there's no "which week" to pick here.
    const handleExportICS = useCallback(() => {
        try {
            const exportTitle = selectedClass?.name || selectedTeacher?.name || 'UniTimetable';
            const ics = generateICS(entriesToDisplay, { calendarName: exportTitle });
            const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${exportTitle.replace(/\s+/g, '_')}.ics`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('ICS export failed:', err);
            showToast('A naptár exportálása nem sikerült.', 'error');
        }
    }, [selectedClass, selectedTeacher, entriesToDisplay]);

    // Wire up export refs so App.tsx dock buttons can trigger them
    useEffect(() => {
        if (onExportRef) onExportRef.current = handleExportImage;
        return () => { if (onExportRef) onExportRef.current = null; };
    }, [onExportRef, handleExportImage]);

    useEffect(() => {
        if (onExportIcsRef) onExportIcsRef.current = handleExportICS;
        return () => { if (onExportIcsRef) onExportIcsRef.current = null; };
    }, [onExportIcsRef, handleExportICS]);

    /**
     * Reveal the week's cards once, when a timetable first paints.
     *
     * Keyed on the entry-id set rather than on mount: the grid re-renders
     * constantly (resize tiers, week parity, selection changes) and re-playing
     * the reveal on every one of those would be intolerable. It should fire
     * when you land on the screen or switch to a different timetable, and
     * never otherwise.
     *
     * The 2-D stagger radiates from the top-left, so the grid fills in reading
     * order — earliest day, earliest slot first — which makes the animation
     * describe the data instead of just decorating it.
     */
    const revealKey = useMemo(
        () => entriesToDisplay.map(e => e.id).join(','),
        [entriesToDisplay],
    );

    useEffect(() => {
        if (!revealKey) return;
        // rAF: let the browser lay the grid out before we read it, otherwise
        // the cards animate from wherever they were mid-layout.
        let cleanup = () => { };
        const raf = requestAnimationFrame(() => {
            const cards = gridRef.current?.querySelectorAll('.tt-card-cell');
            if (cards?.length) cleanup = revealGrid(cards, { grid: [dayCount, TIME_SLOTS.length] });
        });
        return () => { cancelAnimationFrame(raf); cleanup(); };
        // dayCount is intentionally omitted: a Saturday appearing shouldn't
        // replay the whole reveal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealKey]);

    // Grouping computation moved directly to renderer below

    if (isLoading || loadingSelections) {
        return (
            <div className="loading-container">
                <div className="spinner" />
                <span>Betöltés...</span>
            </div>
        );
    }

    if (!selectedClass && !selectedTeacher) {
        return (
            <div className="loading-container">
                <span>Válassz osztályt vagy tanárt a beállításokban</span>
            </div>
        );
    }

    // Shared week indicator chip (used in both desktop corner and mobile header)
    const weekChip = (
        <div className="week-indicator-chip" data-week={currentWeekType === 'odd' || currentWeekType === 'even' ? currentWeekType : 'break'}>
            <span className="week-indicator-dot" />
            <span className="week-indicator-label">
                {currentWeekType === 'odd' ? 'Páratlan' : currentWeekType === 'even' ? 'Páros' : 'Szünet'}
            </span>
        </div>
    );

    // Render for Web (Standard Grid) — v3: single surface, hairline grid
    // lines, zero scroll (SPEC_V3_PLAN.md Phase 1)
    if (!isMobile) {
        return (
            <div ref={containerRef} className={`timetable-container tt-${sizeTier}`}>
                {sizeTier === 'too-small' ? (
                    <div className="tt-fallback">
                        <span className="tt-fallback-icon">📐</span>
                        <p>Az ablak túl alacsony az órarend megjelenítéséhez.</p>
                        <p className="tt-fallback-hint">Növeld meg az ablak magasságát.</p>
                    </div>
                ) : (
                    <div ref={gridRef} className="timetable-grid tt-grid" style={{
                        gridTemplateColumns: `76px repeat(${dayCount}, 1fr)`,
                        gridTemplateRows: `auto repeat(${TIME_SLOTS.length}, minmax(0, 1fr))`,
                    }}>
                        {/* Corner cell — week indicator */}
                        <div className="tt-corner" style={{ gridColumn: 1, gridRow: 1 }}>
                            {weekChip}
                        </div>

                        {/* Day headers */}
                        {visibleDays.map((day, index) => (
                            <div
                                key={day}
                                className={`day-header ${index === today ? 'today' : ''}`}
                                style={{ gridColumn: index + 2, gridRow: 1 }}
                            >
                                {day}
                                {index === today && <span className="day-header-today-badge">Ma</span>}
                            </div>
                        ))}

                        {/* Time column + grid line cells */}
                        {TIME_SLOTS.map((slot, slotIndex) => {
                            return (
                                <div key={`slot-row-${slotIndex}`} style={{ display: 'contents' }}>
                                    <div className="time-cell tnum" style={{ gridColumn: 1, gridRow: slotIndex + 2 }}>
                                        <span className="time-label">{slot.label}</span>
                                        <span className="time-range">{slot.start}</span>
                                        <span className="time-range">{slot.end}</span>
                                    </div>

                                    {visibleDays.map((_, dayIndex) => (
                                        <div
                                            key={`slot-bg-${dayIndex}-${slotIndex}`}
                                            className="slot-cell"
                                            style={{ gridColumn: dayIndex + 2, gridRow: slotIndex + 2 }}
                                        ></div>
                                    ))}
                                </div>
                            );
                        })}

                        {/* Render Classes */}
                        {(() => {
                            const grouped = new Map<string, AvailableClassEntry[]>();
                            filteredEntries.forEach(entry => {
                                if (entry.day_of_week === undefined) return;

                                const slotSpan = computeSlotSpan(entry.start_time, entry.end_time);
                                if (!slotSpan) return;
                                const { startSlot, span } = slotSpan;
                                (entry as any)._calculatedSpan = span;

                                const key = `${entry.day_of_week}-${startSlot}`;
                                if (!grouped.has(key)) grouped.set(key, []);
                                grouped.get(key)!.push(entry);
                            });

                            return Array.from(grouped.entries()).map(([key, groupEntries]) => {
                                const [day, startSlot] = key.split('-').map(Number);
                                const maxSpan = Math.max(...groupEntries.map(e => (e as any)._calculatedSpan));

                                return (
                                    <div
                                        key={`class-group-${key}`}
                                        className="tt-event-stack"
                                        style={{
                                            gridRow: `${startSlot + 2} / span ${maxSpan}`,
                                            gridColumn: `${day + 2} / span 1`,
                                        }}
                                    >
                                        {groupEntries.map(entry => (
                                            <motion.div
                                                key={entry.id}
                                                layoutId={`tt-card-${entry.id}`}
                                                className="tt-card-cell"
                                                style={{ flex: 1, minWidth: 0, height: '100%' }}
                                            >
                                                <ClassCard
                                                    data={{
                                                        id: entry.id,
                                                        subjectName: entry.subject_name,
                                                        teacherName: entry.teacher_name,
                                                        teacherCode: entry.teacher_code,
                                                        classroom: entry.classroom,
                                                        className: entry.class_name,
                                                    }}
                                                    showTeacher={true}
                                                    showRoom={true}
                                                    showClassName={entry.class_id !== selectedClass?.id}
                                                    variant="default"
                                                    onClick={() => setDetailEntry(entry)}
                                                />
                                            </motion.div>
                                        ))}
                                    </div>
                                );
                            });
                        })()}

                        {/* Time Line Overlay */}
                        {today >= 0 && today < dayCount && (
                            <div
                                style={{
                                    gridArea: `2 / ${today + 2} / 8 / ${today + 3}`,
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 200,
                                    overflow: 'hidden'
                                }}
                            >
                                <TimeLine
                                    show={preferences.showTimeIndicator}
                                    currentTime={currentTime}
                                />
                            </div>
                        )}
                    </div>
                )}

                <ClassDetailModal
                    entry={detailEntry}
                    layoutId={detailEntry ? `tt-card-${detailEntry.id}` : undefined}
                    onClose={() => setDetailEntry(null)}
                />
            </div>
        );
    }

    // Render for Mobile (Carousel)
    return (
        <div className="timetable-container" style={{ overflow: 'hidden', height: '100%', position: 'relative' }}>
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                    key={currentDayIndex}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 }
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(e, { offset, velocity }) => {
                        const swipe = Math.abs(offset.x) > 50;
                        if (swipe) {
                            if (offset.x > 0) {
                                paginate(-1);
                            } else {
                                paginate(1);
                            }
                        }
                    }}
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: 'calc(100% - 16px)',
                        padding: '0 12px' // Increased padding for a better gutter
                    }}
                >
                    <div className="mobile-day-column" style={{ height: '100%' }}>
                        <div className="mobile-timetable-grid" style={{ gridTemplateRows: `auto repeat(${TIME_SLOTS.length}, minmax(0, 1fr))` }}>
                            {/* Header row for mobile grid — week chip */}
                            <div className="panel" style={{
                                gridColumn: 1,
                                gridRow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px',
                                borderRadius: 'var(--radius-md)',
                            }}>
                                {weekChip}
                            </div>
                            <div className={`mobile-day-header panel ${currentDayIndex === today ? 'today' : ''}`}
                                style={{
                                    background: currentDayIndex === today ? 'var(--accent)' : 'var(--bg-card)',
                                    gridColumn: 2,
                                    gridRow: 1,
                                    marginBottom: 0
                                }}>
                                {DAYS[currentDayIndex]} {currentDayIndex === today && '(Ma)'}
                            </div>

                            {/* Time Slots + Cells */}
                            {TIME_SLOTS.map((slot, slotIndex) => (
                                <div key={`mobile-slot-${currentDayIndex}-${slotIndex}`} style={{ display: 'contents' }}>
                                    <div className="mobile-time-cell panel" style={{ gridRow: slotIndex + 2, gridColumn: 1 }}>
                                        <span className="time-label">{slot.label}</span>
                                        <span className="time-range">{slot.start}</span>
                                    </div>
                                    <div className="slot-cell" style={{
                                        background: 'var(--bg-secondary)',
                                        gridColumn: 2,
                                        gridRow: slotIndex + 2
                                    }}></div>
                                </div>
                            ))}

                            {/* Render Classes for this day */}
                            {(() => {
                                const dayEntries = filteredEntries.filter(e => e.day_of_week === currentDayIndex);
                                const grouped = new Map<number, AvailableClassEntry[]>();

                                dayEntries.forEach(entry => {
                                    const slotSpan = computeSlotSpan(entry.start_time, entry.end_time);
                                    if (!slotSpan) return;
                                    const { startSlot, span } = slotSpan;
                                    (entry as any)._calculatedSpan = span;

                                    if (!grouped.has(startSlot)) grouped.set(startSlot, []);
                                    grouped.get(startSlot)!.push(entry);
                                });

                                return Array.from(grouped.entries()).map(([startSlot, groupEntries]) => {
                                    const maxSpan = Math.max(...groupEntries.map(e => (e as any)._calculatedSpan));
                                    return (
                                        <div
                                            key={`mobile-group-${currentDayIndex}-${startSlot}`}
                                            style={{
                                                gridRow: `${startSlot + 2} / span ${maxSpan}`,
                                                gridColumn: 2,
                                                zIndex: 10,
                                                display: 'flex',
                                                gap: '4px',
                                            }}
                                        >
                                            {groupEntries.map(entry => (
                                                <div key={entry.id} style={{ flex: 1, minWidth: 0 }}>
                                                    <ClassCard
                                                        data={{
                                                            id: entry.id,
                                                            subjectName: entry.subject_name,
                                                            teacherName: entry.teacher_name,
                                                            teacherCode: entry.teacher_code,
                                                            classroom: entry.classroom,
                                                            className: entry.class_name,
                                                        }}
                                                        showTeacher={true}
                                                        showRoom={true}
                                                        variant="compact"
                                                        onClick={() => setDetailEntry(entry)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    );
                                });
                            })()}

                            {/* Time Line for this day column (only if it's today) */}
                            {currentDayIndex === today && (
                                <div style={{
                                    gridRow: '2 / span 6',
                                    gridColumn: 2,
                                    position: 'relative',
                                    pointerEvents: 'none',
                                    zIndex: 200
                                }}>
                                    <TimeLine
                                        show={preferences.showTimeIndicator}
                                        currentTime={currentTime}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* No layoutId on mobile — the carousel's popLayout animation
                owns the cards, so the window uses a plain scale-in */}
            <ClassDetailModal
                entry={detailEntry}
                onClose={() => setDetailEntry(null)}
            />
        </div>
    );
}

// Fixed TimeLine component
function TimeLine({ show, currentTime }: { show: boolean; currentTime: Date }) {
    const getPosition = () => {
        const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
        const slotCount = TIME_SLOTS.length;

        for (let i = 0; i < slotCount; i++) {
            const slot = TIME_SLOTS[i];
            const start = getMinutes(slot.start);
            const end = getMinutes(slot.end);

            // Inside a specific slot
            if (minutes >= start && minutes <= end) {
                const slotProgress = (minutes - start) / (end - start);
                return ((i + slotProgress) / slotCount) * 100;
            }

            // In the gap between this slot and the next
            if (i < slotCount - 1) {
                const nextSlot = TIME_SLOTS[i + 1];
                const nextStart = getMinutes(nextSlot.start);
                if (minutes > end && minutes < nextStart) {
                    // Place marker on the line between slots
                    return ((i + 1) / slotCount) * 100;
                }
            }
        }

        // Before first class
        if (minutes < getMinutes(TIME_SLOTS[0].start)) return 0;
        // After last class
        return 100;
    };

    const [currentPos, setCurrentPos] = useState(getPosition());
    const [instanceKey, setInstanceKey] = useState(0);
    const [prevShow, setPrevShow] = useState(show);

    useEffect(() => {
        setCurrentPos(getPosition());
    }, [currentTime]);

    // Track toggles to generate a new key when toggled ON
    // This allows the exiting animation to finish going DOWN,
    // while the NEW line comes down from the TOP (-10%)
    // (Adjusting state during render, not a ref, so a discarded render
    // can't leave the counter out of sync — see react.dev/learn/you-might-not-need-an-effect)
    if (show !== prevShow) {
        setPrevShow(show);
        if (show) {
            setInstanceKey(k => k + 1);
        }
    }

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key={`timeline-${instanceKey}`}
                    className="time-marker"
                    initial={{ top: '-10%', opacity: 0 }}
                    animate={{ top: `${currentPos}%`, opacity: 1 }}
                    exit={{ top: '110%', opacity: 0 }}
                    transition={{
                        top: { type: 'spring', stiffness: 60, damping: 15 },
                        opacity: { duration: 0.2 }
                    }}
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: '2px', // Make sure this is still applied if CSS class omits something
                    }}
                />
            )}
        </AnimatePresence>
    );
}


// Timetable component for web

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../stores/appStore';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { fetchTimetableEntries, fetchTimetableEntriesByIds, fetchTeacherTimetable } from '@shared/index';
import type { AvailableClassEntry } from '@shared/lib/api';
import type { TimetableEntry } from '@shared/lib/types';
import ClassCard from './ClassCard';

// 2-hour time slots
const TIME_SLOTS = [
    { label: '1-2', start: '08:00', end: '09:50' },
    { label: '3-4', start: '10:00', end: '11:50' },
    { label: '5-6', start: '12:30', end: '14:20' },
    { label: '7-8', start: '14:30', end: '16:20' },
    { label: '9-10', start: '16:30', end: '18:20' },
    { label: '11-12', start: '18:30', end: '20:20' },
];

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'];

import { getAcademicWeek } from '../utils/calendar';

// Find which slot an entry belongs to
function getSlotIndex(startTime: string): number {
    const [hours] = startTime.split(':').map(Number);
    if (hours >= 8 && hours < 10) return 0;
    if (hours >= 10 && hours < 12) return 1;
    if (hours >= 12 && hours < 14) return 2;
    if (hours >= 14 && hours < 16) return 3;
    if (hours >= 16 && hours < 18) return 4;
    if (hours >= 18 && hours < 20) return 5;
    return -1;
}

// Helper to get minutes from "HH:MM"
function getMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

export default function Timetable() {
    const { selectedClass, selectedTeacher, timetableEntries, setTimetableEntries, userSelections, isLoading, preferences } = useAppStore();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const carouselRef = useRef<HTMLDivElement>(null);

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
    const currentWeekType = useMemo(() => {
        const calculatedWeek = getAcademicWeek().type;
        // If it's a break or out of term, we still might want to show *something* or handle it gracefully.
        // For now we just return it, the filter logic might skip odd/even specific classes if it's 'break'.
        if (preferences.invertWeekParity && (calculatedWeek === 'odd' || calculatedWeek === 'even')) {
            return calculatedWeek === 'odd' ? 'even' : 'odd';
        }
        return calculatedWeek;
    }, [preferences.invertWeekParity]);

    const today = new Date().getDay() - 1; // 0 = Monday

    // State for user-selected entries
    const [userSelectedEntries, setUserSelectedEntries] = useState<AvailableClassEntry[]>([]);
    const [loadingSelections, setLoadingSelections] = useState(false);

    // Always fetch original timetable entries for the base schedule
    useEffect(() => {
        if (selectedClass?.id) {
            fetchTimetableEntries(selectedClass.id).then(setTimetableEntries);
        } else if (selectedTeacher?.id) {
            fetchTeacherTimetable(selectedTeacher.id).then(setTimetableEntries);
        }
    }, [selectedClass?.id, selectedTeacher?.id]);

    // Fetch user-selected entries when there are selections
    useEffect(() => {
        if (userSelections.length > 0) {
            setLoadingSelections(true);
            fetchTimetableEntriesByIds(userSelections)
                .then(setUserSelectedEntries)
                .finally(() => setLoadingSelections(false));
        } else {
            setUserSelectedEntries([]);
        }
    }, [userSelections]);

    // Mobile Carousel State
    const [currentDayIndex, setCurrentDayIndex] = useState(today >= 0 && today < 5 ? today : 0);
    const [direction, setDirection] = useState(0);

    const paginate = (newDirection: number) => {
        setDirection(newDirection);
        setCurrentDayIndex(prev => {
            const next = prev + newDirection;
            if (next > 4) return 0;
            if (next < 0) return 4;
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

    // Filter entries for current week
    const filteredEntries = useMemo(() => {
        // Source is either user selections (if any) or default entries
        const source = userSelections.length > 0 ? userSelectedEntries : timetableEntries;

        return source.filter(
            entry => entry.week_type === 'all' || entry.week_type === currentWeekType
        );
    }, [userSelections.length, userSelectedEntries, timetableEntries, currentWeekType]);

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

    // Render for Web (Standard Grid)
    if (!isMobile) {
        return (
            <div className="timetable-container">
                <div className="timetable-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: `80px repeat(${DAYS.length}, 1fr)`,
                    gridTemplateRows: `auto repeat(${TIME_SLOTS.length}, minmax(0, 1fr))`,
                    gap: '4px',
                    position: 'relative'
                }}>
                    {/* Corner cell */}
                    <div className="glass-card" style={{ padding: '12px', textAlign: 'center', gridColumn: 1, gridRow: 1 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            {currentWeekType === 'odd' ? 'Páratlan' : 'Páros'} hét
                        </span>
                    </div>

                    {/* Day headers */}
                    {DAYS.map((day, index) => (
                        <div
                            key={day}
                            className={`day-header glass-card ${index === today ? 'today' : ''}`}
                            style={{
                                background: index === today
                                    ? 'var(--accent)'
                                    : 'var(--bg-card)',
                                gridColumn: index + 2,
                                gridRow: 1
                            }}
                        >
                            {day}
                            {index === today && <span style={{ fontSize: '0.7rem', marginLeft: '6px' }}>Ma</span>}
                        </div>
                    ))}

                    {/* Time slots backgrounds */}
                    {TIME_SLOTS.map((slot, slotIndex) => {
                        return (
                            <div key={`slot-row-${slotIndex}`} style={{ display: 'contents' }}>
                                {/* Time cell */}
                                <div className="time-cell glass-card" style={{ gridColumn: 1, gridRow: slotIndex + 2 }}>
                                    <span className="time-label">{slot.label}</span>
                                    <span className="time-range">{slot.start}</span>
                                    <span className="time-range">{slot.end}</span>
                                </div>

                                {/* Day cells (Backgrounds) */}
                                {DAYS.map((_, dayIndex) => {
                                    return (
                                        <div
                                            key={`slot-bg-${dayIndex}-${slotIndex}`}
                                            className="slot-cell"
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                gridColumn: dayIndex + 2,
                                                gridRow: slotIndex + 2
                                            }}
                                        ></div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Render Classes */}
                    {(() => {
                        const grouped = new Map<string, AvailableClassEntry[]>();
                        filteredEntries.forEach(entry => {
                            if (entry.day_of_week === undefined) return;

                            let startSlot = -1;
                            let endSlot = -1;
                            TIME_SLOTS.forEach((_, i) => {
                                const slotStart = getMinutes(TIME_SLOTS[i].start);
                                const slotEnd = getMinutes(TIME_SLOTS[i].end);
                                const entryStart = getMinutes(entry.start_time);
                                const entryEnd = getMinutes(entry.end_time);

                                if (Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd)) {
                                    if (startSlot === -1) startSlot = i;
                                    endSlot = i;
                                }
                            });

                            if (startSlot === -1) return;
                            const span = endSlot - startSlot + 1;
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
                                    style={{
                                        gridRow: `${startSlot + 2} / span ${maxSpan}`,
                                        gridColumn: `${day + 2} / span 1`,
                                        zIndex: 10,
                                        display: 'flex',
                                        flexDirection: 'row',
                                        gap: '4px',
                                    }}
                                >
                                    {groupEntries.map(entry => (
                                        <div key={entry.id} style={{ flex: 1, minWidth: 0, height: '100%' }}>
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
                                            />
                                        </div>
                                    ))}
                                </div>
                            );
                        });
                    })()}

                    {/* Time Line Overlay */}
                    {today >= 0 && today < 5 && (
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
                            {/* Header row for mobile grid */}
                            <div className="glass-card" style={{
                                gridColumn: 1,
                                gridRow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px',
                                fontSize: '0.6rem',
                                color: 'var(--text-secondary)',
                                textAlign: 'center',
                                borderRadius: '12px'
                            }}>
                                {currentWeekType === 'odd' ? 'Páratlan' : 'Páros'}
                            </div>
                            <div className={`mobile-day-header glass-card ${currentDayIndex === today ? 'today' : ''}`}
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
                                    <div className="mobile-time-cell glass-card" style={{ gridRow: slotIndex + 2, gridColumn: 1 }}>
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
                                    let startSlot = -1;
                                    let endSlot = -1;
                                    TIME_SLOTS.forEach((_, i) => {
                                        const slotStart = getMinutes(TIME_SLOTS[i].start);
                                        const slotEnd = getMinutes(TIME_SLOTS[i].end);
                                        const entryStart = getMinutes(entry.start_time);
                                        const entryEnd = getMinutes(entry.end_time);
                                        if (Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd)) {
                                            if (startSlot === -1) startSlot = i;
                                            endSlot = i;
                                        }
                                    });

                                    if (startSlot === -1) return;
                                    const span = endSlot - startSlot + 1;
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
    const instanceKeyRef = useRef(0);
    const prevShowRef = useRef(show);

    useEffect(() => {
        setCurrentPos(getPosition());
    }, [currentTime]);

    // Track toggles to generate a new key when toggled ON
    // This allows the exiting animation to finish going DOWN,
    // while the NEW line comes down from the TOP (-10%)
    if (show && !prevShowRef.current) {
        instanceKeyRef.current += 1;
    }
    prevShowRef.current = show;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key={`timeline-${instanceKeyRef.current}`}
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

function usePrevious(value: boolean) {
    const ref = useRef<boolean>(value);
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}


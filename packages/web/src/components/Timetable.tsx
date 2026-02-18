// Timetable component for web

import { useEffect, useMemo, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppStore } from '../stores/appStore';
import { fetchTimetableEntries, fetchTimetableEntriesByIds } from '@shared/index';
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

// Get current week type (odd or even)
// Get current week type (odd or even)
// NOTE: This week calculation might need adjustment based on the specific university calendar
function getCurrentWeekType(): 'odd' | 'even' {
    const now = new Date();
    // Get the first day of the year
    const oneJan = new Date(now.getFullYear(), 0, 1);

    // Calculate full weeks to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    const currentDayNum = now.getDay() || 7;
    const oneJanDayNum = oneJan.getDay() || 7;

    // Calculate number of days between now and oneJan
    const numberOfDays = Math.floor((now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));

    // Calculate week number
    const result = Math.ceil((numberOfDays + oneJanDayNum) / 7);

    // This usually matches ISO week numbers
    return result % 2 !== 0 ? 'odd' : 'even';
}

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
    const { selectedClass, timetableEntries, setTimetableEntries, userSelections, isLoading, preferences } = useAppStore();

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
        const calculatedWeek = getCurrentWeekType();
        if (preferences.invertWeekParity) {
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
        }
    }, [selectedClass?.id]);

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

    // Group entries by day and slot
    const getEntriesForSlot = (dayIndex: number, slotIndex: number): AvailableClassEntry[] => {
        const slot = TIME_SLOTS[slotIndex];
        const slotStart = getMinutes(slot.start);
        const slotEnd = getMinutes(slot.end);

        return (filteredEntries as AvailableClassEntry[]).filter(entry => {
            if (entry.day_of_week !== dayIndex) return false;

            const entryStart = getMinutes(entry.start_time);
            const entryEnd = getMinutes(entry.end_time);

            // Overlap condition: max(start1, start2) < min(end1, end2)
            return Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd);
        });
    };

    if (isLoading || loadingSelections) {
        return (
            <div className="loading-container">
                <div className="spinner" />
                <span>Betöltés...</span>
            </div>
        );
    }

    if (!selectedClass) {
        return (
            <div className="loading-container">
                <span>Válassz osztályt a beállításokban</span>
            </div>
        );
    }

    return (
        <div className="timetable-container">
            <div className="timetable-grid" style={{
                display: 'grid',
                gridTemplateColumns: `80px repeat(${DAYS.length}, 1fr)`,
                gap: '4px',
                position: 'relative' // Needed for absolute positioning of TimeLine overlay
            }}>
                {/* Corner cell */}
                <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
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
                        }}
                    >
                        {day}
                        {index === today && <span style={{ fontSize: '0.7rem', marginLeft: '6px' }}>Ma</span>}
                    </div>
                ))}

                {/* Time slots and classes */}
                {TIME_SLOTS.map((slot, slotIndex) => {
                    return (
                        <div key={`slot-row-${slotIndex}`} style={{ display: 'contents' }}>
                            {/* Time cell */}
                            <div className="time-cell glass-card">
                                <span className="time-label">{slot.label}</span>
                                <span className="time-range">{slot.start}</span>
                                <span className="time-range">{slot.end}</span>
                            </div>

                            {/* Day cells */}
                            {DAYS.map((_, dayIndex) => {
                                const entries = getEntriesForSlot(dayIndex, slotIndex);
                                // Old marker logic removed from here

                                return (
                                    <div
                                        key={`slot-${dayIndex}-${slotIndex}`}
                                        className="slot-cell"
                                        style={{ background: 'var(--bg-secondary)' }}
                                    >
                                        {entries.map((entry) => (
                                            <ClassCard
                                                key={entry.id}
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
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {/* Global Time Line Overlay - Animated */}
                {today >= 0 && today < 5 && (
                    <div
                        style={{
                            gridArea: `2 / ${today + 2} / 8 / ${today + 3}`, // Explicit RowStart / ColStart / RowEnd / ColEnd
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            zIndex: 200,
                            overflow: 'hidden'     // Hide line when it flies out bottom
                        }}
                    >
                        <TimeLine
                            show={preferences.showTimeIndicator}
                            currentTime={currentTime}
                        />
                    </div>
                )}
            </div>
        </div >
    );
}

// Separate component for robust animation lifecycle management using motion
function TimeLine({ show, currentTime }: { show: boolean; currentTime: Date }) {
    const [resetKey, setResetKey] = useState(0);

    // Force a fresh mount whenever the line is turned on to ensure it starts from the top
    useEffect(() => {
        if (show) {
            setResetKey(prev => prev + 1);
        }
    }, [show]);

    // Current position calculation (08:00 - 20:00 range)
    const getPosition = () => {
        const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
        const start = 480; // 08:00
        const range = 720; // 12 hours
        // Clamp between 0 and 100
        return Math.min(100, Math.max(0, ((minutes - start) / range) * 100));
    };

    const currentPos = getPosition();

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key={resetKey}
                    className="time-marker"
                    initial={{ top: '-10%', opacity: 0 }}
                    animate={{ top: `${currentPos}%`, opacity: 1 }}
                    exit={{ top: '150%', opacity: 0 }}
                    transition={{
                        top: { duration: 1.5, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.5 }
                    }}
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        zIndex: 210,
                        pointerEvents: 'none',
                        transform: 'translateZ(0)'
                    }}
                />
            )}
        </AnimatePresence>
    );
}


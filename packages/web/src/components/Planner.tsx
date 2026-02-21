// Planner component for web - allows selecting classes from available options

import { useState, useEffect, useMemo, useRef, useCallback, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppStore } from '../stores/appStore';
import { fetchAvailableClassesForPlanner, fetchTimetableEntries } from '@shared/index';
import type { AvailableClassEntry } from '@shared/lib/api';
import GlareHover from './GlareHover';
import AnimatedList from './AnimatedList';
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

// Map time to slot index
function getSlotIndex(startTime: string): number {
    if (!startTime) return -1;
    // Handle "08:00:00" or "08:00" formats
    const hour = parseInt(startTime.split(':')[0], 10);
    if (hour >= 8 && hour < 10) return 0;
    if (hour >= 10 && hour < 12) return 1;
    if (hour >= 12 && hour < 14) return 2;
    if (hour >= 14 && hour < 16) return 3;
    if (hour >= 16 && hour < 18) return 4;
    if (hour >= 18) return 5;
    return -1;
}

// Helper to get minutes from "HH:MM"
function getMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

// Check if an entry overlaps with a slot
function isEntryInSlot(entryStartTime: string, entryEndTime: string, slotIndex: number): boolean {
    const entryStart = getMinutes(entryStartTime);
    const entryEnd = getMinutes(entryEndTime);
    const slot = TIME_SLOTS[slotIndex];
    if (!slot) return false;
    const slotStart = getMinutes(slot.start);
    const slotEnd = getMinutes(slot.end);
    return Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd);
}

interface PlannerProps {
    onSaveRef?: RefObject<(() => void) | null>;
    onCountChange?: (count: number) => void;
    onSavingChange?: (saving: boolean) => void;
    classTypeSearch?: string;
    onClassTypeSearchChange?: (value: string) => void;
    includeCrossMajor: boolean;
    onIncludeCrossMajorChange: (value: boolean) => void;
}

export default function Planner({ onSaveRef, onCountChange, onSavingChange, classTypeSearch = '', onClassTypeSearchChange, includeCrossMajor, onIncludeCrossMajorChange }: PlannerProps) {
    const { selectedClass, userSelections, addSelection, removeSelection, clearSelections, importedSubjects } = useAppStore();

    const [availableClasses, setAvailableClasses] = useState<Map<string, AvailableClassEntry[]>>(new Map());
    const [selectedSlots, setSelectedSlots] = useState<Map<string, AvailableClassEntry[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [activeSlot, setActiveSlot] = useState<{ day: number; slot: number } | null>(null);
    const [activeHalf, setActiveHalf] = useState<'odd' | 'even' | 'full' | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);


    // Notify parent of saving changes
    useEffect(() => {
        onSavingChange?.(saving);
    }, [saving, onSavingChange]);

    const saveSelections = useCallback(async () => {
        setSaving(true);
        setSaveMessage(null);

        try {
            const entryIds = Array.from(selectedSlots.values()).flat().map(item => item.id);

            // Clear old selections first
            await clearSelections();

            // Add new selections
            for (const id of entryIds) {
                await addSelection(id);
            }

            setSaveMessage({ type: 'success', text: `${entryIds.length} óra mentve!` });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('Save failed:', error);
            setSaveMessage({ type: 'error', text: 'Nem sikerült menteni.' });
        } finally {
            setSaving(false);
        }
    }, [selectedSlots, clearSelections, addSelection]);

    // Refs for cells and wrapper
    const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Notify parent of count changes
    useEffect(() => {
        let totalCount = 0;
        selectedSlots.forEach(entries => {
            totalCount += entries.length;
        });
        onCountChange?.(totalCount);
    }, [selectedSlots, onCountChange]);

    // Load available classes
    useEffect(() => {
        if (selectedClass?.id) {
            // Include importedSubjects as dependency to trigger reload when they change
            loadAvailableClasses();
        }
    }, [selectedClass?.id, includeCrossMajor, importedSubjects]); // Added importedSubjects dependency

    const syncedClassId = useRef<string | null>(null);

    // Load existing user selections into selectedSlots when availableClasses are loaded
    useEffect(() => {
        if (selectedClass?.id && availableClasses.size > 0 && syncedClassId.current !== selectedClass.id) {
            const newSelectedSlots = new Map<string, AvailableClassEntry[]>();

            availableClasses.forEach((classes, key) => {
                const selectedInSlot: AvailableClassEntry[] = [];
                classes.forEach(cls => {
                    if (userSelections.includes(cls.id)) {
                        selectedInSlot.push(cls);
                    }
                });
                if (selectedInSlot.length > 0) {
                    newSelectedSlots.set(key, selectedInSlot);
                }
            });

            setSelectedSlots(newSelectedSlots);
            syncedClassId.current = selectedClass.id;
        }
    }, [userSelections, availableClasses, selectedClass?.id]);

    // Expose save function to parent via ref
    useEffect(() => {
        if (onSaveRef) {
            // @ts-ignore
            onSaveRef.current = saveSelections;
        }
        return () => {
            if (onSaveRef) {
                // @ts-ignore
                onSaveRef.current = null;
            }
        };
    }, [onSaveRef, saveSelections]);

    const loadAvailableClasses = async () => {
        if (!selectedClass?.id) return;

        setLoading(true);
        try {
            // Pass importedSubjects to API
            const entries = await fetchAvailableClassesForPlanner(selectedClass.id, importedSubjects, includeCrossMajor);

            const grouped = new Map<string, AvailableClassEntry[]>();

            entries.forEach((entry) => {
                TIME_SLOTS.forEach((_, slotIndex) => {
                    if (!isEntryInSlot(entry.start_time, entry.end_time, slotIndex)) return;

                    const key = `${entry.day_of_week}-${slotIndex}`;

                    if (!grouped.has(key)) {
                        grouped.set(key, []);
                    }

                    const existing = grouped.get(key)!;

                    // Deduplication logic
                    let isDuplicate = false;

                    if (includeCrossMajor) {
                        // In extended mode, we show duplicates unless they are exact matches (same subject, class, teacher, room)
                        // This allows seeing the SAME subject taught to DIFFERENT groups or by DIFFERENT teachers
                        isDuplicate = existing.some(e =>
                            e.subject_name === entry.subject_name &&
                            e.class_id === entry.class_id &&
                            e.teacher_name === entry.teacher_name &&
                            e.classroom === entry.classroom
                        );
                    } else {
                        // Standard mode: Aggressive deduplication by subject name to keep the view clean
                        isDuplicate = existing.some(e => e.subject_name === entry.subject_name);
                    }

                    if (!isDuplicate) {
                        existing.push(entry);
                    }
                });
            });

            setAvailableClasses(grouped);
        } catch (err) {
            console.error('Failed to load classes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSlotClick = (dayIndex: number, slotIndex: number, half: 'odd' | 'even' | 'full' = 'full') => {
        const key = `${dayIndex}-${slotIndex}`;
        const options = availableClasses.get(key) || [];
        const hasSelected = selectedSlots.has(key);

        if (options.length === 0 && !hasSelected) return;

        if (activeSlot?.day === dayIndex && activeSlot?.slot === slotIndex && activeHalf === half) {
            setActiveSlot(null);
            setActiveHalf(null);
            setDropdownPos(null);
        } else {
            setActiveSlot({ day: dayIndex, slot: slotIndex });
            setActiveHalf(half);

            // Calculate dropdown position from cell's actual position
            // For multi-slot classes, we always anchor to the start slot
            let targetSlotIndex = slotIndex;
            const entries = getSelectedEntries(dayIndex, slotIndex);

            // If the user clicked a slot that is COVERED by an absolute card, we should find that card's start
            // and anchor the dropdown there. However, we already disabled clicks on covered slots.
            // If the user clicks existing selection, anchor to its start slot.
            if (entries.length > 0) {
                const { startSlot } = getSpanInfo(entries[0], slotIndex);
                targetSlotIndex = startSlot;
            }

            const targetKey = `${dayIndex}-${targetSlotIndex}`;
            const cellEl = cellRefs.current.get(targetKey);
            const wrapperEl = wrapperRef.current;
            if (cellEl && wrapperEl) {
                const cellRect = cellEl.getBoundingClientRect();
                const wrapperRect = wrapperEl.getBoundingClientRect();

                const isBottomRows = targetSlotIndex >= TIME_SLOTS.length - 2;

                setDropdownPos({
                    left: cellRect.left - wrapperRect.left - 4,
                    top: isBottomRows ? undefined : cellRect.bottom - wrapperRect.top + 4,
                    bottom: isBottomRows ? wrapperRect.bottom - cellRect.top + 4 : undefined,
                    width: cellRect.width + 8,
                });
            }
        }
    };

    // Delete a specific entry from a slot
    const deleteEntry = (dayIndex: number, slotIndex: number, entryId: string) => {
        const key = `${dayIndex}-${slotIndex}`;
        const currentSelections = selectedSlots.get(key) || [];
        const newSelections = currentSelections.filter(e => e.id !== entryId);

        // Update local state only (manual save model)
        const newSelectionsMap = new Map(selectedSlots);
        if (newSelections.length > 0) {
            newSelectionsMap.set(key, newSelections);
        } else {
            newSelectionsMap.delete(key);
        }
        setSelectedSlots(newSelectionsMap);
        // Close any open dropdown
        setActiveSlot(null);
        setActiveHalf(null);
        setDropdownPos(null);
    };

    const loadDefaults = async () => {
        if (!selectedClass?.id) {
            console.log('No selected class ID');
            return;
        }

        console.log('Loading defaults for class:', selectedClass.id);

        if (availableClasses.size === 0) {
            console.log('Available classes empty, fetching...');
            await loadAvailableClasses();
        }

        setLoading(true);
        try {
            let defaults = await fetchTimetableEntries(selectedClass.id);
            console.log('Fetched defaults:', defaults);

            const available = await fetchAvailableClassesForPlanner(selectedClass.id);
            console.log('Fetched available:', available);

            // Re-build map for this scope WITH DEDUPLICATION
            const availableMap = new Map<string, AvailableClassEntry[]>();
            available.forEach((entry) => {
                const time = (entry as any).startTime || entry.start_time;
                const endTime = (entry as any).endTime || entry.end_time;
                const dayIndex = (entry as any).dayOfWeek ?? entry.day_of_week;

                if (dayIndex === undefined) return;

                TIME_SLOTS.forEach((_, slotIndex) => {
                    if (!isEntryInSlot(time, endTime, slotIndex)) return;

                    const key = `${dayIndex}-${slotIndex}`;
                    const list = availableMap.get(key) || [];

                    // Deduplicate: If we already have a class with this name in this slot, skip it.
                    // This merges "Lecture (Group A)" and "Lecture (Group B)" if they have same subject name.
                    const subjectName = (entry as any).subjectName || entry.subject_name;
                    if (!list.some(e => {
                        const eKey = (e as any).subjectName || e.subject_name;
                        return eKey === subjectName;
                    })) {
                        list.push(entry);
                    }
                    availableMap.set(key, list);
                });
            });

            setAvailableClasses(availableMap);

            console.log('Selected Class ID:', selectedClass.id);
            console.log('Selected Class Name:', selectedClass.name);
            const uniqueAvailableNames = Array.from(new Set(available.map(a => a.class_name).filter(Boolean)));
            console.log('Available Class Names found:', uniqueAvailableNames);

            // Fallback: If defaults are empty/stale, try to find current class entries in available list
            if ((!defaults || defaults.length === 0) && available.length > 0) {
                console.log('Defaults empty. Attempting smart fallbacks...');

                // 1. Try ID match
                const idMatch = available.filter(a => a.class_id === selectedClass.id);
                if (idMatch.length > 0) {
                    defaults = idMatch;
                    console.log('Fallback 1: ID match count:', defaults.length);
                }

                // 2. Direct Name Match
                if (defaults.length === 0 && selectedClass.name) {
                    const exactMatch = available.filter(a => a.class_name === selectedClass.name);
                    if (exactMatch.length > 0) {
                        defaults = exactMatch;
                        console.log('Fallback 2: Exact Name match count:', defaults.length);
                    }
                }

                // 3. Smart Name Match (Weighted Token Overlap)
                if (defaults.length === 0 && selectedClass.name) {
                    console.log('Fallback 3: Attempting Smart Name Match...');

                    // Get all unique class names from available list
                    const candidateNames = Array.from(new Set(available.map(a => a.class_name).filter(Boolean))) as string[];

                    if (candidateNames.length > 0) {
                        const targetTokens = selectedClass.name.toLowerCase().split(/\s+|[.,]/).filter(Boolean);

                        let bestName = '';
                        let bestScore = -1;

                        candidateNames.forEach(name => {
                            const candidateTokens = name.toLowerCase().split(/\s+|[.,]/).filter(Boolean);
                            let score = 0;
                            // Count overlapping tokens
                            targetTokens.forEach(t => {
                                if (candidateTokens.includes(t)) score++;
                            });
                            // Bonus for exact suffix match (Group Code like "A" or "B")
                            const targetSuffix = targetTokens[targetTokens.length - 1];
                            const candidateSuffix = candidateTokens[candidateTokens.length - 1];
                            if (targetSuffix === candidateSuffix && targetSuffix.length === 1) {
                                score += 3; // High importance on group letter
                            }

                            if (score > bestScore) {
                                bestScore = score;
                                bestName = name;
                            }
                        });

                        console.log(`Smart Match Result: Best Name="${bestName}" with Score=${bestScore}`);

                        if (bestName && bestScore > 0) {
                            defaults = available.filter(a => a.class_name === bestName);
                            console.log(`Fallback 2: Smart match found ${defaults.length} entries for ${bestName}`);
                        } else {
                            console.error(`Fallback failed. Target ID: ${selectedClass.id}, Target Name: ${selectedClass.name}. Available names:`, candidateNames);
                        }
                    }
                }
            }

            if (defaults.length === 0) {
                console.error("DEFAULTS IS STILL EMPTY. IT WILL NOT LOAD ANYTHING.");
            }

            const newSelectedSlots = new Map<string, AvailableClassEntry[]>();

            if (defaults.length > 0) {
                console.log('Sample defaults entry keys:', Object.keys(defaults[0]));
            }

            defaults.forEach(entry => {
                const time = (entry as any).startTime || entry.start_time;
                const endTime = (entry as any).endTime || entry.end_time;
                const dayIndex = (entry as any).dayOfWeek ?? entry.day_of_week;
                const weekType = (entry as any).weekType ?? entry.week_type;
                const subjectName = (entry as any).subjectName || entry.subject_name;

                console.log(`Processing: ${subjectName}, Time: ${time}, Day: ${dayIndex}`);

                if (dayIndex === undefined) return;

                TIME_SLOTS.forEach((_, slotIndex) => {
                    if (!isEntryInSlot(time, endTime, slotIndex)) return;

                    const key = `${dayIndex}-${slotIndex}`;
                    const options = availableMap.get(key) || [];

                    // 1. Try ID match
                    let fullEntry = options.find(o => o.id === entry.id);

                    // 2. Try content match
                    if (!fullEntry) {
                        fullEntry = options.find(o =>
                            o.subject_name.trim() === subjectName.trim() &&
                            o.week_type === weekType
                        );
                    }

                    // 3. Synthetic fallback
                    if (!fullEntry) {
                        console.log(`Creating synthetic entry for ${subjectName}`);
                        fullEntry = {
                            ...entry,
                            class_name: selectedClass.name,
                        } as AvailableClassEntry;
                    }

                    if (fullEntry) {
                        const existing = newSelectedSlots.get(key) || [];

                        // Deduplicate in slot: Don't add if SAME SUBJECT is already there
                        // This prevents "Lecture" appearing 3 times in the same cell.
                        if (!existing.some(e => e.subject_name === fullEntry!.subject_name)) {
                            newSelectedSlots.set(key, [...existing, fullEntry]);
                            console.log(`Added to slot ${key}`);
                        }
                    }
                });
            });

            console.log('Final Selected Slots Map Size:', newSelectedSlots.size);
            setSelectedSlots(newSelectedSlots);

            if (newSelectedSlots.size > 0) {
                setSaveMessage({ type: 'success', text: 'Eredeti órarend betöltve!' });
            } else {
                setSaveMessage({ type: 'error', text: 'Nem található óra (Próbáld újraválasztani a csoportot)' });
            }
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
            console.error('Failed to load defaults:', err);
            setSaveMessage({ type: 'error', text: 'Hiba a betöltés közben.' });
        } finally {
            setLoading(false);
        }
    };

    const selectClass = (entry: AvailableClassEntry | null) => {
        if (!activeSlot) return;

        let targetSlot = activeSlot.slot;
        if (entry) {
            // Find true start slot so multi-slot classes anchor to their correct start position
            let entryStartSlot = -1;
            TIME_SLOTS.forEach((_, i) => {
                const slotStart = getMinutes(TIME_SLOTS[i].start);
                const slotEnd = getMinutes(TIME_SLOTS[i].end);
                const entryStart = getMinutes(entry.start_time);
                const entryEnd = getMinutes(entry.end_time);
                if (Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd)) {
                    if (entryStartSlot === -1) entryStartSlot = i;
                }
            });
            if (entryStartSlot !== -1) {
                targetSlot = entryStartSlot;
            }
        }

        const slotKey = `${activeSlot.day}-${targetSlot}`;

        // Use functional update to ensure we always read the latest state
        setSelectedSlots(prevSlots => {
            const currentSelections = prevSlots.get(slotKey) || [];
            let newSlotSelections: AvailableClassEntry[] = [];

            if (entry) {
                if (entry.week_type === 'all') {
                    // "Every week" class replaces everything
                    newSlotSelections = [entry];
                } else {
                    // "Odd" or "Even" class
                    // Remove any full-week ('all') classes - they must be replaced
                    // Keep only compatible bi-weekly classes (opposite week type)
                    const compatible = currentSelections.filter(s =>
                        s.week_type !== 'all' && s.week_type !== entry.week_type
                    );
                    newSlotSelections = [...compatible, entry];
                }
            }

            // Update local state ONLY (manual save model)
            const newMap = new Map(prevSlots);
            if (newSlotSelections.length > 0) {
                newMap.set(slotKey, newSlotSelections);
            } else {
                newMap.delete(slotKey);
            }
            return newMap;
        });

        // Close dropdown
        setActiveSlot(null);
        setActiveHalf(null);
        setDropdownPos(null);
    };

    const getSlotOptions = (): AvailableClassEntry[] => {
        if (!activeSlot) return [];
        const key = `${activeSlot.day}-${activeSlot.slot}`;
        return (availableClasses.get(key) || []).sort((a, b) =>
            a.subject_name.localeCompare(b.subject_name)
        );
    };

    const getSelectedEntries = (dayIndex: number, slotIndex: number): AvailableClassEntry[] => {
        const key = `${dayIndex}-${slotIndex}`;
        return selectedSlots.get(key) || [];
    };

    // Calculate span for a given entry
    const getSpanInfo = (entry: AvailableClassEntry, defaultStartSlot?: number) => {
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
        if (startSlot === -1) return { startSlot: defaultStartSlot ?? 0, span: 1 };
        return { startSlot, span: endSlot - startSlot + 1 };
    };

    // Check if a cell is covered by an absolute card from a previous slot
    const isSlotCovered = (dayIndex: number, slotIndex: number): boolean => {
        for (let prevSlot = 0; prevSlot < slotIndex; prevSlot++) {
            const prevEntries = getSelectedEntries(dayIndex, prevSlot);
            for (const entry of prevEntries) {
                const { startSlot, span } = getSpanInfo(entry, prevSlot);
                if (startSlot + span > slotIndex) {
                    return true;
                }
            }
        }
        return false;
    };

    const normalizedSearch = classTypeSearch.trim().toLowerCase();
    const highlightedSlotKeys = useMemo(() => {
        if (!normalizedSearch) return new Set<string>();

        const matches = new Set<string>();
        availableClasses.forEach((entries, key) => {
            const hasMatch = entries.some((entry) => {
                const searchHaystack = [
                    entry.subject_name,
                    entry.teacher_name,
                    entry.classroom,
                    entry.class_name,
                    entry.week_type,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return searchHaystack.includes(normalizedSearch);
            });

            if (hasMatch) {
                matches.add(key);
            }
        });

        return matches;
    }, [availableClasses, normalizedSearch]);

    // Calculate dropdown options with visual grouping based on activeHalf
    const getAllOptions = () => getSlotOptions();

    let dropdownOptions: (AvailableClassEntry | { id: string; isDivider: true })[] = [];

    if (activeSlot && activeHalf) {
        const rawOptions = getAllOptions();

        if (activeHalf === 'full') {
            // Empty slot or clicking whole slot - show all options
            dropdownOptions = rawOptions.slice(0, 6);
        } else if (activeHalf === 'odd') {
            // Clicking the top half (odd) - show Odd classes to add
            const compatibleClasses = rawOptions.filter(o => o.week_type === 'odd');
            const replaceClasses = rawOptions.filter(o => o.week_type === 'all');

            if (compatibleClasses.length > 0 || replaceClasses.length > 0) {
                dropdownOptions = [
                    ...compatibleClasses,
                    ...(replaceClasses.length > 0 ? [
                        { id: 'divider-replace', isDivider: true as const },
                        ...replaceClasses
                    ] : [])
                ].slice(0, 8);
            }
        } else if (activeHalf === 'even') {
            // Clicking the bottom half (even) - show Even classes to add
            const compatibleClasses = rawOptions.filter(o => o.week_type === 'even');
            const replaceClasses = rawOptions.filter(o => o.week_type === 'all');

            if (compatibleClasses.length > 0 || replaceClasses.length > 0) {
                dropdownOptions = [
                    ...compatibleClasses,
                    ...(replaceClasses.length > 0 ? [
                        { id: 'divider-replace', isDivider: true as const },
                        ...replaceClasses
                    ] : [])
                ].slice(0, 8);
            }
        }
    }
    const hasSelectedInActiveSlot = activeSlot ? getSelectedEntries(activeSlot.day, activeSlot.slot).length > 0 : false;

    if (loading) {
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
        <div className="planner-container">
            {saveMessage && (
                <div
                    className={`save-message-floating glass-card ${saveMessage.type}`}
                    style={{
                        position: 'fixed',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        padding: '12px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border)',
                        color: saveMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
                        background: 'var(--bg-secondary)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '12px'
                    }}
                >
                    {saveMessage.type === 'success' ? '✅' : '❌'} {saveMessage.text}
                </div>
            )}

            {selectedSlots.size === 0 && availableClasses.size > 0 && (
                <div className="planner-empty-state">
                    <p>Nincs óra kiválasztva</p>
                    <button
                        className="btn btn-primary"
                        onClick={loadDefaults}
                    >
                        🔄 Eredeti órarend betöltése
                    </button>
                </div>
            )}

            {/* Controls moved to Header */}


            {/* Planner Grid */}
            <div className={`planner-grid-wrapper ${selectedSlots.size === 0 ? 'empty' : ''}`} ref={wrapperRef} style={{ opacity: selectedSlots.size === 0 ? 0.3 : 1 }}>
                <div className="planner-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: `80px repeat(${DAYS.length}, 1fr)`,
                    gap: '4px'
                }}>
                    {/* Corner cell */}
                    <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            Időpont
                        </span>
                    </div>

                    {/* Day headers */}
                    {DAYS.map((day, index) => (
                        <div
                            key={day}
                            className="day-header glass-card"
                            style={{ background: 'var(--bg-card)' }}
                        >
                            {day}
                        </div>
                    ))}

                    {/* Time slots and cells */}
                    {TIME_SLOTS.map((slot, slotIndex) => (
                        <div key={`row-${slotIndex}`} className="planner-row-group" style={{ display: 'contents' }}>
                            {/* Time cell */}
                            <div key={`time-${slotIndex}`} className="time-cell glass-card">
                                <span className="time-label">{slot.label}</span>
                                <span className="time-range">{slot.start}</span>
                                <span className="time-range">{slot.end}</span>
                            </div>

                            {/* Day cells */}
                            {DAYS.map((_, dayIndex) => {
                                const selectedEntries = getSelectedEntries(dayIndex, slotIndex);
                                const hasOptions = (availableClasses.get(`${dayIndex}-${slotIndex}`) || []).length > 0;
                                const isActive = activeSlot?.day === dayIndex && activeSlot?.slot === slotIndex;
                                const cellKey = `${dayIndex}-${slotIndex}`;

                                // Find specific entries
                                const oddEntry = selectedEntries.find(e => e.week_type === 'odd');
                                const evenEntry = selectedEntries.find(e => e.week_type === 'even');
                                const fullEntry = selectedEntries.find(e => e.week_type === 'all');

                                // Logic: If we have an odd entry but no even entry, show a placeholder for even
                                // If we have an even entry but no odd entry, show a placeholder for odd
                                const showOddPlaceholder = !oddEntry && !fullEntry && evenEntry;
                                const showEvenPlaceholder = !evenEntry && !fullEntry && oddEntry;

                                const hasSelection = selectedEntries.length > 0;
                                const isSearchMatch = highlightedSlotKeys.has(cellKey);
                                const isCovered = isSlotCovered(dayIndex, slotIndex);

                                // Render helper for a half-slot card
                                const renderCard = (entry: AvailableClassEntry, position: 'top' | 'bottom' | 'single') => {
                                    const { startSlot, span } = getSpanInfo(entry, slotIndex);

                                    // Deduplicate rendering: Only render if this slot is the actual start slot
                                    if (slotIndex !== startSlot) {
                                        // Render an invisible spacer so flex layout stays intact for the OTHER half
                                        return <div key={`${entry.id}-spacer`} style={{ flex: 1, visibility: 'hidden' }} />;
                                    }

                                    const isEntryActive = activeSlot &&
                                        activeSlot.day === dayIndex &&
                                        activeSlot.slot >= startSlot &&
                                        activeSlot.slot < startSlot + span;

                                    const isAbsolute = span > 1;
                                    let heightStr = undefined;
                                    if (isAbsolute) {
                                        // A cell comprises exactly 86px height based on index.css (.planner-slot-cell height: 86px)
                                        // The planner grid gap is 4px.
                                        const CELL_HEIGHT = 86;
                                        const GAP = 4;

                                        heightStr = position === 'single'
                                            ? `calc(${span * CELL_HEIGHT + (span - 1) * GAP}px)`
                                            : `calc(${span * CELL_HEIGHT + (span - 1) * GAP}px)`; // Even half-slots consume the full vertical space of their respective grid rows over the span
                                    }

                                    return (
                                        <div
                                            key={entry.id}
                                            className={`half-slot-card-wrapper slot-${position} ${isEntryActive ? 'active' : ''}`}
                                            style={{
                                                flex: isAbsolute ? undefined : 1,
                                                width: '100%',
                                                position: isAbsolute ? 'absolute' : 'relative',
                                                top: isAbsolute ? (position === 'bottom' ? '50%' : 0) : undefined,
                                                left: 0,
                                                right: 0,
                                                zIndex: isAbsolute ? 20 : 1,
                                                height: heightStr,
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSlotClick(dayIndex, startSlot, entry.week_type === 'all' ? 'full' : entry.week_type as 'odd' | 'even');
                                            }}
                                        >
                                            <ClassCard
                                                data={{
                                                    id: entry.id,
                                                    subjectName: entry.subject_name || 'Ismeretlen tárgy',
                                                    teacherName: entry.teacher_name || '',
                                                    classroom: entry.classroom || '',
                                                    className: entry.class_name,
                                                }}
                                                showTeacher={entry.week_type === 'all' || span > 1}
                                                showRoom={entry.week_type === 'all' || span > 1}
                                                showClassName={entry.class_id !== selectedClass?.id}
                                                variant="compact"
                                            />
                                            <button
                                                className="half-slot-delete-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteEntry(dayIndex, startSlot, entry.id);
                                                }}
                                                title="Törlés"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                };

                                // Render helper for empty half plus button
                                const renderPlusButton = (half: 'odd' | 'even') => (
                                    <div
                                        className="half-slot-plus"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSlotClick(dayIndex, slotIndex, half);
                                        }}
                                    >
                                        <span>+</span>
                                    </div>
                                );

                                return (
                                    <div
                                        key={`slot-${dayIndex}-${slotIndex}`}
                                        ref={(el) => {
                                            if (el) cellRefs.current.set(cellKey, el);
                                        }}
                                        className={`planner-slot-cell ${isActive ? 'active' : ''} ${!isCovered && (hasOptions || hasSelection) ? 'clickable' : ''} ${hasSelection ? 'has-selection' : ''} ${isCovered ? 'is-covered' : ''} ${normalizedSearch ? 'search-active' : ''} ${isSearchMatch ? 'search-match' : ''}`}
                                        style={{
                                            background: hasSelection || isCovered ? 'transparent' : 'var(--bg-secondary)',
                                            borderColor: isActive && !hasSelection && !isCovered
                                                ? 'var(--accent)'
                                                : (isSearchMatch ? 'rgba(220, 224, 235, 0.85)' : 'transparent'),
                                            opacity: activeSlot && !isActive ? 0.4 : 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 0,
                                            pointerEvents: isCovered ? 'none' : 'auto',
                                        }}
                                        onClick={() => {
                                            if (!hasSelection && hasOptions && !isCovered) {
                                                handleSlotClick(dayIndex, slotIndex, 'full');
                                            }
                                        }}
                                    >
                                        {fullEntry ? (
                                            renderCard(fullEntry, 'single')
                                        ) : !oddEntry && !evenEntry ? (
                                            // Completely empty slot with options
                                            !isCovered && (
                                                <div
                                                    className="empty-slot-plus"
                                                    style={{ flex: 1 }}
                                                    onClick={(e) => {
                                                        if (hasOptions) handleSlotClick(dayIndex, slotIndex, 'full');
                                                    }}
                                                >
                                                    {hasOptions && <span>+</span>}
                                                </div>
                                            )
                                        ) : (
                                            <>
                                                {oddEntry ? (
                                                    renderCard({ ...oddEntry, week_type: 'odd' }, 'top')
                                                ) : (
                                                    <div
                                                        className="half-slot-plus slot-top"
                                                        style={{ flex: 1 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (hasOptions) handleSlotClick(dayIndex, slotIndex, 'odd');
                                                        }}
                                                    >
                                                        {showOddPlaceholder && hasOptions && <span>+</span>}
                                                    </div>
                                                )}

                                                {evenEntry ? (
                                                    renderCard({ ...evenEntry, week_type: 'even' }, 'bottom')
                                                ) : (
                                                    <div
                                                        className="half-slot-plus slot-bottom"
                                                        style={{ flex: 1 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (hasOptions) handleSlotClick(dayIndex, slotIndex, 'even');
                                                        }}
                                                    >
                                                        {showEvenPlaceholder && hasOptions && <span>+</span>}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {activeSlot && (
                    <div
                        className="planner-backdrop"
                        onClick={() => {
                            setActiveSlot(null);
                            setActiveHalf(null);
                        }}
                    />
                )}

                <AnimatePresence>
                    {activeSlot && dropdownPos && (
                        <motion.div
                            key="planner-dropdown"
                            className="planner-dropdown"
                            style={{
                                left: dropdownPos.left,
                                top: dropdownPos.top,
                                bottom: dropdownPos.bottom,
                                width: dropdownPos.width,
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <AnimatedList
                                items={[
                                    ...dropdownOptions.map((item) => {
                                        if ('isDivider' in item) {
                                            return (
                                                <div key={item.id} className="dropdown-divider">
                                                    <span>Replace with</span>
                                                </div>
                                            );
                                        }
                                        const entry = item as AvailableClassEntry;
                                        return (
                                            <ClassCard
                                                key={entry.id}
                                                data={{
                                                    id: entry.id,
                                                    subjectName: entry.subject_name,
                                                    teacherName: entry.teacher_name,
                                                    classroom: entry.classroom,
                                                    className: entry.class_name,
                                                }}
                                                showTeacher={true}
                                                showRoom={true}
                                                showClassName={true}
                                                variant="dropdown"
                                                enableGlare={true}
                                            />
                                        );
                                    }),
                                    ...(hasSelectedInActiveSlot ? [
                                        <GlareHover
                                            key="clear-btn"
                                            background="rgba(239, 68, 68, 0.15)"
                                            borderColor="rgba(239, 68, 68, 0.4)"
                                            borderRadius="8px"
                                            glareColor="#ffffff"
                                            glareOpacity={0.2}
                                            glareAngle={-30}
                                            glareSize={200}
                                            transitionDuration={600}
                                            playOnce={false}
                                            className="dropdown-clear-btn"
                                        >
                                            🗑️ Törlés
                                        </GlareHover>
                                    ] : []),
                                    ...(dropdownOptions.length === 0 && hasSelectedInActiveSlot ? [
                                        <div key="empty-msg" className="dropdown-empty">
                                            Nincs más opció
                                        </div>
                                    ] : [])
                                ]}
                                onItemSelect={(index) => {
                                    if (index < dropdownOptions.length) {
                                        const item = dropdownOptions[index];
                                        if ('isDivider' in item) return;
                                        selectClass(item as AvailableClassEntry);
                                    } else {
                                        selectClass(null);
                                    }
                                }}
                                showGradients={dropdownOptions.length > 3}
                                enableArrowNavigation={true}
                                displayScrollbar={false}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Dimensions, Pressable, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { useAppStore, TimetableEntry } from '@/stores/appStore';
import { fetchTimetableEntries, getSubjectColor, getCurrentWeekParity, assignSubjectColors } from '@unitimetable/shared';
import { palette, radius, fonts } from '@/constants/theme';
import { syncWidget } from '@/widget/widget-sync';

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'];
const DAYS_SHORT = ['H', 'K', 'Sz', 'Cs', 'P'];

// Combined 2-hour time slots matching the web app
const COMBINED_SLOTS = [
    { label: '1-2', start: '08:00', end: '09:50', display: '8:00 - 9:50' },
    { label: '3-4', start: '10:00', end: '11:50', display: '10:00 - 11:50' },
    { label: '5-6', start: '12:30', end: '14:20', display: '12:30 - 14:20' },
    { label: '7-8', start: '14:30', end: '16:20', display: '14:30 - 16:20' },
    { label: '9-10', start: '16:30', end: '18:20', display: '16:30 - 18:20' },
    { label: '11-12', start: '18:30', end: '20:20', display: '18:30 - 20:20' },
];

const SINGLE_SLOTS: Record<number, { start: string; end: string }> = {
    1: { start: '08:00', end: '08:50' },
    2: { start: '09:00', end: '09:50' },
    3: { start: '10:00', end: '10:50' },
    4: { start: '11:00', end: '11:50' },
    5: { start: '12:30', end: '13:20' },
    6: { start: '13:30', end: '14:20' },
    7: { start: '14:30', end: '15:20' },
    8: { start: '15:30', end: '16:20' },
    9: { start: '16:30', end: '17:20' },
    10: { start: '17:30', end: '18:20' },
    11: { start: '18:30', end: '19:20' },
    12: { start: '19:30', end: '20:20' },
};

// Map a single-hour start time to 2-hour slot index
function getSlotIndex(startTime: string): number {
    const [h, m] = startTime.split(':').map(Number);
    const minutes = h * 60 + m;

    if (minutes < 600) return 0;       // before 10:00 → slot 0
    if (minutes < 750) return 1;       // before 12:30 → slot 1
    if (minutes < 870) return 2;       // before 14:30 → slot 2
    if (minutes < 990) return 3;       // before 16:30 → slot 3
    if (minutes < 1110) return 4;      // before 18:30 → slot 4
    return 5;                           // slot 5
}

// Helper to get minutes from "HH:MM" or "HH:MM:SS"
function getMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

// Get current time position for the indicator
function getCurrentTimePosition(): { slotIndex: number; progress: number } | null {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < COMBINED_SLOTS.length; i++) {
        const slot = COMBINED_SLOTS[i];
        const [sh, sm] = slot.start.split(':').map(Number);
        const [eh, em] = slot.end.split(':').map(Number);
        const slotStart = sh * 60 + sm;
        const slotEnd = eh * 60 + em;

        if (currentMinutes >= slotStart && currentMinutes <= slotEnd) {
            return {
                slotIndex: i,
                progress: (currentMinutes - slotStart) / (slotEnd - slotStart),
            };
        }
    }
    return null;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLOT_HEIGHT = 100;

export default function TimetableScreen() {
    const { selectedClass, timetableEntries, setTimetableEntries } = useAppStore();
    const [currentDayIndex, setCurrentDayIndex] = useState(Math.min(new Date().getDay() - 1, 4));
    const [timePos, setTimePos] = useState(getCurrentTimePosition());
    const pagerRef = useRef<PagerView>(null);

    // Fix sunday/saturday to monday
    useEffect(() => {
        const day = new Date().getDay();
        if (day === 0 || day === 6) setCurrentDayIndex(0);
    }, []);

    // Load timetable data (and refresh the home-screen widget with it)
    useEffect(() => {
        if (selectedClass?.id) {
            fetchTimetableEntries(selectedClass.id).then((entries) => {
                if (entries.length > 0) {
                    setTimetableEntries(entries);
                    syncWidget(entries);
                }
            });
        }
    }, [selectedClass?.id]);

    // Update time indicator every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setTimePos(getCurrentTimePosition());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Deterministic subject colors: assign from the full (sorted) subject set
    // so cards match the home-screen widget exactly.
    useEffect(() => {
        if (timetableEntries.length > 0) {
            assignSubjectColors(timetableEntries.map(e => e.subject_name));
        }
    }, [timetableEntries]);

    const weekType = getCurrentWeekParity();

    // Get entries for a 2-hour combined slot
    const getEntriesForSlot = useCallback(
        (dayIndex: number, slotIndex: number) => {
            const slot = COMBINED_SLOTS[slotIndex];
            const slotStart = getMinutes(slot.start);
            const slotEnd = getMinutes(slot.end);

            return timetableEntries.filter((entry) => {
                if (entry.day_of_week !== dayIndex) return false;

                const entryStart = getMinutes(entry.start_time);
                const entryEnd = getMinutes(entry.end_time);

                // Overlap condition: max(start1, start2) < min(end1, end2)
                const isOverlapping = Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd);

                if (!isOverlapping) return false;

                // Filter by week type
                if (entry.week_type === 'all') return true;
                return entry.week_type === weekType;
            });
        },
        [timetableEntries, weekType]
    );







    return (
        <SafeAreaView style={styles.container}>
            {/* Day selector pills */}
            <View style={styles.daySelector}>
                {DAYS.map((day, index) => (
                    <Pressable
                        key={day}
                        style={[
                            styles.dayPill,
                            currentDayIndex === index && styles.dayPillActive,
                        ]}
                        onPress={() => {
                            setCurrentDayIndex(index);
                            pagerRef.current?.setPage(index);
                        }}
                    >
                        <Text
                            style={[
                                styles.dayPillText,
                                currentDayIndex === index && styles.dayPillTextActive,
                            ]}
                        >
                            {DAYS_SHORT[index]}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Day name header */}
            <View style={styles.header}>
                <Text style={styles.dayTitle}>{DAYS[currentDayIndex]}</Text>
                <Text style={styles.weekType}>
                    {weekType === 'odd' ? 'Páratlan hét' : 'Páros hét'}
                </Text>
            </View>

            <PagerView
                style={styles.pager}
                initialPage={currentDayIndex}
                ref={pagerRef}
                onPageSelected={(e) => setCurrentDayIndex(e.nativeEvent.position)}
            >
                {DAYS.map((day, dayIndex) => (
                    <View key={day} style={styles.dayPage}>
                        <ScrollView
                            contentContainerStyle={styles.dayPageContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {COMBINED_SLOTS.map((slot, slotIndex) => {
                                const slotEntries = getEntriesForSlot(dayIndex, slotIndex);
                                const isCurrentSlot =
                                    timePos?.slotIndex === slotIndex &&
                                    currentDayIndex === new Date().getDay() - 1;

                                return (
                                    <View key={slotIndex} style={styles.slotRow}>
                                        {/* Time Column */}
                                        <View style={styles.timeLabel}>
                                            <Text style={styles.timeLabelText}>{slot.start}</Text>
                                            <Text style={styles.timeLabelEnd}>{slot.end}</Text>
                                        </View>

                                        {/* Content Column */}
                                        <View style={styles.slotContent}>
                                            {/* Time Indicator Line */}
                                            {isCurrentSlot && timePos && (
                                                <View
                                                    style={[
                                                        styles.timeIndicator,
                                                        { top: `${timePos.progress * 100}%` },
                                                    ]}
                                                />
                                            )}

                                            {slotEntries.length > 0 ? (
                                                slotEntries.map((entry, i) => {
                                                    const subjectColor = getSubjectColor(entry.subject_name);
                                                    return (
                                                    <View key={i} style={styles.classCard}>
                                                        <View style={styles.classCardBar}>
                                                            <View
                                                                style={[
                                                                    styles.classCardBarHalf,
                                                                    { backgroundColor: subjectColor, opacity: entry.week_type === 'even' ? 0.35 : 1 },
                                                                ]}
                                                            />
                                                            <View
                                                                style={[
                                                                    styles.classCardBarHalf,
                                                                    { backgroundColor: subjectColor, opacity: entry.week_type === 'odd' ? 0.35 : 1 },
                                                                ]}
                                                            />
                                                        </View>
                                                        <View style={styles.classCardContent}>
                                                            <Text style={styles.className} numberOfLines={2}>
                                                                {entry.subject_name}
                                                            </Text>
                                                            {entry.teacher_name && (
                                                                <Text style={styles.classTeacher} numberOfLines={1}>
                                                                    {entry.teacher_name}
                                                                </Text>
                                                            )}
                                                            <View style={styles.classRoomRow}>
                                                                <Text style={styles.classRoom}>
                                                                    {entry.classroom}
                                                                </Text>
                                                                {entry.week_type !== 'all' && (
                                                                    <Text style={styles.weekBadge}>
                                                                        {entry.week_type === 'odd' ? '1. hét' : '2. hét'}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                    );
                                                })
                                            ) : (
                                                <View style={styles.emptySlot}>
                                                    <Text style={styles.emptySlotText}>-</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                ))}
            </PagerView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.bgApp,
    },
    // Day selector
    daySelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 8,
    },
    dayPill: {
        width: 48,
        height: 36,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.bgSurface,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
    },
    dayPillActive: {
        borderColor: palette.accent,
        borderBottomWidth: 2,
    },
    dayPillText: {
        fontSize: 15,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
    },
    dayPillTextActive: {
        color: palette.accent,
    },
    // Header
    header: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    dayTitle: {
        fontSize: 24,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
    },
    weekType: {
        fontSize: 13,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
    },
    // Pager
    pager: {
        flex: 1,
    },
    dayPage: {
        flex: 1,
    },
    dayPageContent: {
        paddingHorizontal: 12,
        paddingBottom: 24,
    },
    // Slot row
    slotRow: {
        flexDirection: 'row',
        minHeight: SLOT_HEIGHT,
        marginBottom: 4,
    },
    timeLabel: {
        width: 52,
        paddingTop: 12,
        paddingRight: 8,
        alignItems: 'flex-end',
    },
    timeLabelText: {
        fontSize: 13,
        fontFamily: fonts.monoMedium,
        color: palette.textSecondary,
    },
    timeLabelEnd: {
        fontSize: 11,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
        marginTop: 2,
    },
    slotContent: {
        flex: 1,
        position: 'relative',
        minHeight: SLOT_HEIGHT,
    },
    // Time indicator
    timeIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: palette.danger,
        zIndex: 10,
    },
    // Class card — neutral surface, subject colour lives on the top bar
    classCard: {
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderDefault,
        backgroundColor: palette.bgElevated,
        marginBottom: 4,
        minHeight: SLOT_HEIGHT - 8,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    classCardBar: {
        flexDirection: 'row',
        height: 3,
    },
    classCardBarHalf: {
        flex: 1,
    },
    classCardContent: {
        padding: 12,
    },
    className: {
        fontSize: 15,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginBottom: 4,
    },
    classTeacher: {
        fontSize: 13,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        marginBottom: 4,
    },
    classRoomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    classRoom: {
        fontSize: 12,
        fontFamily: fonts.monoMedium,
        color: palette.textPrimary,
    },
    weekBadge: {
        fontSize: 11,
        fontFamily: fonts.monoMedium,
        color: palette.textSecondary,
        backgroundColor: palette.bgInset,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.xs,
        overflow: 'hidden',
    },
    // Empty slot
    emptySlot: {
        minHeight: SLOT_HEIGHT - 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        borderStyle: 'dashed',
    },
    emptySlotText: {
        fontSize: 16,
        color: palette.textTertiary,
    },
    // Empty state (no class selected)
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 24,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        textAlign: 'center',
    },
});

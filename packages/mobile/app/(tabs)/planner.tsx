import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
    Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/stores/appStore';
import { supabase, fetchTimetableEntriesForFacultyYear, AvailableClassEntry, TimetableEntry } from '@unitimetable/shared';
import { palette, radius, fonts } from '@/constants/theme';

const DAYS = ['Hé', 'Ke', 'Sz', 'Cs', 'Pé'];

const COMBINED_SLOTS = [
    { label: '1-2', start: '08:00', end: '09:50' },
    { label: '3-4', start: '10:00', end: '11:50' },
    { label: '5-6', start: '12:30', end: '14:20' },
    { label: '7-8', start: '14:30', end: '16:20' },
    { label: '9-10', start: '16:30', end: '18:20' },
    { label: '11-12', start: '18:30', end: '20:20' },
];

function getSlotIndex(startTime: string): number {
    const [h, m] = startTime.split(':').map(Number);
    const minutes = h * 60 + m;
    if (minutes < 600) return 0;
    if (minutes < 750) return 1;
    if (minutes < 870) return 2;
    if (minutes < 990) return 3;
    if (minutes < 1110) return 4;
    return 5;
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
    const slot = COMBINED_SLOTS[slotIndex];
    if (!slot) return false;
    const slotStart = getMinutes(slot.start);
    const slotEnd = getMinutes(slot.end);
    return Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd);
}

export default function PlannerScreen() {
    const { selectedClass, userSelections, addSelection, removeSelection } = useAppStore();
    const [availableClasses, setAvailableClasses] = useState<Record<string, AvailableClassEntry[]>>({});
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeSlot, setActiveSlot] = useState<{ day: number; slot: number } | null>(null);

    // Fetch all available classes for the selected class's faculty/year
    useEffect(() => {
        if (!selectedClass) return;
        loadAvailableClasses();
    }, [selectedClass]);

    const loadAvailableClasses = async () => {
        if (!selectedClass) return;
        setLoading(true);

        try {
            // Get all classes in the same faculty
            const { data: allClasses } = await supabase
                .from('classes')
                .select('id, name, faculty, year')
                .eq('faculty', selectedClass.faculty)
                .eq('year', selectedClass.year);

            if (!allClasses || allClasses.length === 0) {
                setLoading(false);
                return;
            }

            // Get all timetable entries for those classes
            // (goes through the shared API so the v3 dual-read adapter applies)
            const entries = await fetchTimetableEntriesForFacultyYear(
                selectedClass.faculty, selectedClass.year);

            if (entries.length === 0) {
                setLoading(false);
                return;
            }

            // Group by day-slot key
            const grouped: Record<string, AvailableClassEntry[]> = {};
            entries.forEach((entry) => {
                const className = allClasses.find((c) => c.id === entry.class_id)?.name || '';

                COMBINED_SLOTS.forEach((_, slotIdx) => {
                    if (!isEntryInSlot(entry.start_time, entry.end_time, slotIdx)) return;

                    const key = `${entry.day_of_week}-${slotIdx}`;

                    if (!grouped[key]) grouped[key] = [];

                    // Avoid duplicates
                    const exists = grouped[key].some(
                        (e) =>
                            e.subject_name === entry.subject_name &&
                            e.class_id === entry.class_id &&
                            e.week_type === entry.week_type
                    );
                    if (!exists) {
                        grouped[key].push({
                            ...entry,
                            class_name: className,
                            week_type: entry.week_type as any,
                        });
                    }
                });
            });

            setAvailableClasses(grouped);
        } catch (err) {
            console.error('Failed to load planner data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSlotPress = (day: number, slot: number) => {
        const key = `${day}-${slot}`;
        const options = availableClasses[key];
        if (!options || options.length === 0) return;

        setActiveSlot({ day, slot });
        setModalVisible(true);
    };

    const getSelectedForSlot = (day: number, slot: number): AvailableClassEntry | null => {
        const key = `${day}-${slot}`;
        const options = availableClasses[key];
        if (!options) return null;
        return options.find((o) => userSelections.includes(o.id)) || null;
    };

    const handleSelect = async (entry: AvailableClassEntry) => {
        // Remove any existing selection in this slot
        if (activeSlot) {
            const key = `${activeSlot.day}-${activeSlot.slot}`;
            const options = availableClasses[key] || [];
            for (const opt of options) {
                if (userSelections.includes(opt.id)) {
                    await removeSelection(opt.id);
                }
            }
        }
        await addSelection(entry.id);
        setModalVisible(false);
    };

    const handleClear = async () => {
        if (activeSlot) {
            const key = `${activeSlot.day}-${activeSlot.slot}`;
            const options = availableClasses[key] || [];
            for (const opt of options) {
                if (userSelections.includes(opt.id)) {
                    await removeSelection(opt.id);
                }
            }
        }
        setModalVisible(false);
    };

    if (!selectedClass) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>✏️</Text>
                    <Text style={styles.emptyTitle}>Tervező</Text>
                    <Text style={styles.emptySubtitle}>
                        Válassz csoportot a Beállításokban
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={[styles.emptySubtitle, { marginTop: 16 }]}>
                        Adatok betöltése...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Tervező</Text>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Day headers */}
                <View style={styles.gridRow}>
                    <View style={styles.timeCol} />
                    {DAYS.map((day) => (
                        <View key={day} style={styles.dayHeader}>
                            <Text style={styles.dayHeaderText}>{day}</Text>
                        </View>
                    ))}
                </View>

                {/* Grid */}
                {COMBINED_SLOTS.map((slot, slotIndex) => (
                    <View key={slotIndex} style={styles.gridRow}>
                        <View style={styles.timeCol}>
                            <Text style={styles.timeText}>{slot.label}</Text>
                        </View>
                        {DAYS.map((_, dayIndex) => {
                            const selected = getSelectedForSlot(dayIndex, slotIndex);
                            const key = `${dayIndex}-${slotIndex}`;
                            const hasOptions = (availableClasses[key]?.length || 0) > 0;

                            return (
                                <TouchableOpacity
                                    key={dayIndex}
                                    style={[
                                        styles.cell,
                                        selected && styles.cellSelected,
                                        !selected && hasOptions && styles.cellAvailable,
                                    ]}
                                    onPress={() => handleSlotPress(dayIndex, slotIndex)}
                                    disabled={!hasOptions}
                                    activeOpacity={0.7}
                                >
                                    {selected && (
                                        <View style={[styles.cellBar, { backgroundColor: selected.color || palette.accent }]} />
                                    )}
                                    {selected ? (
                                        <>
                                            <Text style={styles.cellText} numberOfLines={2}>
                                                {selected.subject_name}
                                            </Text>
                                            <Text style={styles.cellSub} numberOfLines={1}>
                                                {selected.classroom || ''}
                                            </Text>
                                        </>
                                    ) : hasOptions ? (
                                        <Text style={styles.cellPlus}>+</Text>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>

            {/* Selection modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setModalVisible(false)}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>
                            {activeSlot
                                ? `${DAYS[activeSlot.day]} · ${COMBINED_SLOTS[activeSlot.slot].label}. óra`
                                : ''}
                        </Text>

                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {activeSlot &&
                                (availableClasses[`${activeSlot.day}-${activeSlot.slot}`] || []).map(
                                    (entry) => {
                                        const isSelected = userSelections.includes(entry.id);
                                        return (
                                            <TouchableOpacity
                                                key={entry.id}
                                                style={[
                                                    styles.optionCard,
                                                    isSelected && styles.optionCardActive,
                                                    { borderLeftColor: entry.color || palette.accent },
                                                ]}
                                                onPress={() => handleSelect(entry)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.optionName}>
                                                        {entry.subject_name}
                                                    </Text>
                                                    {entry.teacher_name && (
                                                        <Text style={styles.optionTeacher}>
                                                            {entry.teacher_name}
                                                        </Text>
                                                    )}
                                                    <View style={styles.optionMeta}>
                                                        {entry.classroom && (
                                                            <Text style={styles.optionRoom}>
                                                                📍 {entry.classroom}
                                                            </Text>
                                                        )}
                                                        {entry.class_name && (
                                                            <Text style={styles.optionGroup}>
                                                                {entry.class_name.split(' ').slice(-1)[0]}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                                {isSelected && (
                                                    <Text style={styles.checkmark}>✓</Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }
                                )}

                            {/* Clear button */}
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={handleClear}
                            >
                                <Text style={styles.clearButtonText}>Törlés</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const CELL_SIZE = 56;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.bgApp,
    },
    title: {
        fontSize: 28,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 8,
        paddingBottom: 24,
    },
    // Grid
    gridRow: {
        flexDirection: 'row',
        marginBottom: 3,
    },
    timeCol: {
        width: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 11,
        fontFamily: fonts.monoMedium,
        color: palette.textTertiary,
    },
    dayHeader: {
        flex: 1,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayHeaderText: {
        fontSize: 13,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
    },
    cell: {
        flex: 1,
        height: CELL_SIZE,
        backgroundColor: palette.bgSurface,
        borderRadius: radius.sm,
        marginHorizontal: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 3,
        borderWidth: 1,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    cellSelected: {
        backgroundColor: palette.bgElevated,
        borderColor: palette.borderDefault,
    },
    cellAvailable: {
        borderColor: palette.borderSubtle,
        borderStyle: 'dashed',
    },
    cellBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    cellText: {
        fontSize: 9,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        textAlign: 'center',
    },
    cellSub: {
        fontSize: 8,
        fontFamily: fonts.mono,
        color: palette.textSecondary,
        textAlign: 'center',
        marginTop: 1,
    },
    cellPlus: {
        fontSize: 18,
        color: palette.textTertiary,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: palette.bgElevated,
        borderTopLeftRadius: radius.md,
        borderTopRightRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderDefault,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '70%',
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: palette.borderStrong,
        borderRadius: radius.pill,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        marginBottom: 16,
    },
    modalScroll: {
        maxHeight: 400,
    },
    optionCard: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        padding: 14,
        marginBottom: 8,
        borderLeftWidth: 3,
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionCardActive: {
        backgroundColor: palette.accentSubtle,
        borderColor: palette.accentLine,
    },
    optionName: {
        fontSize: 15,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginBottom: 3,
    },
    optionTeacher: {
        fontSize: 13,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        marginBottom: 4,
    },
    optionMeta: {
        flexDirection: 'row',
        gap: 8,
    },
    optionRoom: {
        fontSize: 12,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
    },
    optionGroup: {
        fontSize: 11,
        fontFamily: fonts.monoMedium,
        color: palette.accent,
    },
    checkmark: {
        fontSize: 20,
        color: palette.accent,
        fontFamily: fonts.sansBold,
        marginLeft: 8,
    },
    clearButton: {
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    clearButtonText: {
        fontSize: 15,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
    },
    // Empty state
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

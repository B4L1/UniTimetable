// Timetable Planner - Clean dropdown design overlaying cells

import { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Pressable,
    ActivityIndicator,
    useWindowDimensions,
    Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
    FadeIn,
    FadeOut,
    FadeInDown,
    FadeInUp,
    Layout,
} from 'react-native-reanimated';

import { useAppStore } from '@/stores/appStore';
import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getSubjectColor } from '@/lib/colors';

// 2-hour time slots
const TIME_SLOTS = [
    { label: '1-2', start: '08:00', end: '09:50' },
    { label: '3-4', start: '10:00', end: '11:50' },
    { label: '5-6', start: '12:30', end: '14:20' },
    { label: '7-8', start: '14:30', end: '16:20' },
    { label: '9-10', start: '16:30', end: '18:20' },
    { label: '11-12', start: '18:30', end: '20:20' },
];

const DAYS = ['Hé', 'Ke', 'Sz', 'Cs', 'Pé'];

interface AvailableClass {
    id: string;
    subject_name: string;
    teacher_name: string | null;
    classroom: string | null;
    class_name: string;
    color: string | null;
    week_type: string;
}

// Map time to slot index
function getSlotIndex(startTime: string): number {
    const hour = parseInt(startTime.split(':')[0]);
    if (hour >= 8 && hour < 10) return 0;
    if (hour >= 10 && hour < 12) return 1;
    if (hour >= 12 && hour < 14) return 2;
    if (hour >= 14 && hour < 16) return 3;
    if (hour >= 16 && hour < 18) return 4;
    if (hour >= 18) return 5;
    return -1;
}

export default function PlannerScreen() {
    const { t } = useTranslation();
    const { width, height } = useWindowDimensions();
    const { preferences, selectedClass, addSelection, userSelections, clearSelections } = useAppStore();

    const [availableClasses, setAvailableClasses] = useState<Map<string, AvailableClass[]>>(new Map());
    const [selectedSlots, setSelectedSlots] = useState<Map<string, AvailableClass>>(new Map());
    const [loading, setLoading] = useState(true);
    const [activeSlot, setActiveSlot] = useState<{
        day: number;
        slot: number;
        x: number;
        y: number;
        openUpward: boolean;
    } | null>(null);
    const [showSearchModal, setShowSearchModal] = useState(false);

    const isDark = preferences.theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    // Calculate dimensions
    const headerHeight = 56;
    const timeColumnWidth = 60;
    const dayColumnWidth = Math.max(140, (width - timeColumnWidth) / 5);
    const slotHeight = 90;
    const cardHeight = 76;

    useEffect(() => {
        if (selectedClass?.id) {
            loadAvailableClasses();
        }
    }, [selectedClass?.id]);

    // Load existing user selections into selectedSlots when availableClasses are loaded
    useEffect(() => {
        if (userSelections.length > 0 && availableClasses.size > 0) {
            const newSelectedSlots = new Map<string, AvailableClass>();

            // Find each userSelection in availableClasses and add to selectedSlots
            availableClasses.forEach((classes, key) => {
                classes.forEach(cls => {
                    if (userSelections.includes(cls.id)) {
                        newSelectedSlots.set(key, cls);
                    }
                });
            });

            setSelectedSlots(newSelectedSlots);
        }
    }, [userSelections, availableClasses]);

    const loadAvailableClasses = async () => {
        if (!selectedClass?.id) return;

        setLoading(true);
        try {
            // First get the class info to know faculty and year
            const { data: classInfo } = await supabase
                .from('classes')
                .select('faculty, year')
                .eq('id', selectedClass.id)
                .single();

            if (!classInfo) throw new Error('Class not found');

            // Get all class IDs with same faculty and year (all groups)
            const { data: sameYearClasses } = await supabase
                .from('classes')
                .select('id')
                .eq('faculty', classInfo.faculty)
                .eq('year', classInfo.year);

            const classIds = sameYearClasses?.map(c => c.id) || [selectedClass.id];

            // Fetch entries for all classes of same faculty/year
            const { data, error } = await supabase
                .from('timetable_entries')
                .select(`
          id,
          subject_name,
          teacher_name,
          classroom,
          day_of_week,
          start_time,
          color,
          week_type,
          class_id,
          classes (name)
        `)
                .in('class_id', classIds)
                .order('subject_name');

            if (error) throw error;

            const grouped = new Map<string, AvailableClass[]>();

            data?.forEach((entry: any) => {
                const slotIndex = getSlotIndex(entry.start_time);
                if (slotIndex < 0) return;

                const key = `${entry.day_of_week}-${slotIndex}`;

                if (!grouped.has(key)) {
                    grouped.set(key, []);
                }

                const existing = grouped.get(key)!;
                if (!existing.some(e => e.subject_name === entry.subject_name)) {
                    existing.push({
                        id: entry.id,
                        subject_name: entry.subject_name,
                        teacher_name: entry.teacher_name,
                        classroom: entry.classroom,
                        class_name: entry.classes?.name || '',
                        color: entry.color,
                        week_type: entry.week_type,
                    });
                }
            });

            setAvailableClasses(grouped);
        } catch (err) {
            console.error('Failed to load classes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSlotPress = (dayIndex: number, slotIndex: number) => {
        if (activeSlot && activeSlot.day === dayIndex && activeSlot.slot === slotIndex) {
            setActiveSlot(null);
            return;
        }

        // Calculate position relative to gridWrapper
        const cellMargin = 2;
        const x = timeColumnWidth + (dayIndex * dayColumnWidth) + cellMargin;

        // Grid dimensions
        const dayHeaderHeight = 44;

        // Open upward for bottom 2 rows (slot 4 and 5)
        const openUpward = slotIndex >= 4;

        // Y position from top of grid to top of cell
        // Each slot is slotHeight (90px) + 4px total margin (2px top + 2px bottom)
        const slotTotalHeight = slotHeight + 4;
        const cellTop = dayHeaderHeight + (slotIndex * slotTotalHeight) + cellMargin;

        // For upward: position so the dropdown ends at cell bottom
        // We'll adjust in the render based on number of items
        const y = cellTop;

        setActiveSlot({ day: dayIndex, slot: slotIndex, x, y, openUpward });
    };

    const selectClass = (entry: AvailableClass | null) => {
        if (activeSlot) {
            const key = `${activeSlot.day}-${activeSlot.slot}`;
            const newSelections = new Map(selectedSlots);

            if (entry) {
                newSelections.set(key, entry);
            } else {
                newSelections.delete(key);
            }

            setSelectedSlots(newSelections);
        }
        setActiveSlot(null);
    };

    const getSlotOptions = (): AvailableClass[] => {
        if (!activeSlot) return [];
        const key = `${activeSlot.day}-${activeSlot.slot}`;
        return availableClasses.get(key) || [];
    };

    const getSelectedEntry = (dayIndex: number, slotIndex: number): AvailableClass | null => {
        const key = `${dayIndex}-${slotIndex}`;
        return selectedSlots.get(key) || null;
    };

    const saveSelections = async () => {
        console.log('Save button clicked! Entries:', selectedSlots.size);
        try {
            // Get all selected entry IDs
            const entryIds = Array.from(selectedSlots.values()).map(item => item.id);
            console.log('Entry IDs to save:', entryIds);

            // Clear old selections first, then save new ones
            await clearSelections();

            for (const id of entryIds) {
                await addSelection(id);
            }

            console.log('All saved! userSelections replaced with:', entryIds.length, 'entries');
            Alert.alert('Mentve!', `${entryIds.length} óra mentve az órarendhez.`);
        } catch (error) {
            console.error('Save failed:', error);
            Alert.alert('Hiba', 'Nem sikerült menteni.');
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.tint} />
            </View>
        );
    }

    const options = getSlotOptions()
        .sort((a, b) => a.subject_name.localeCompare(b.subject_name)); // Alphabetical A-Z

    // Limit to 4 items, reverse for upward opening
    const limitedOptions = options.slice(0, 4);
    const displayOptions = activeSlot?.openUpward ? [...limitedOptions].reverse() : limitedOptions;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder, height: headerHeight }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {t('planner.title')}
                </Text>
                <View style={styles.headerRight}>
                    <Text style={[styles.countText, { color: colors.textSecondary }]}>
                        {selectedSlots.size} óra
                    </Text>
                    {selectedSlots.size > 0 && (
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: colors.tint }]}
                            onPress={saveSelections}
                        >
                            <FontAwesome name="save" size={14} color="#fff" />
                            <Text style={styles.saveButtonText}>Mentés</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
            >
                <View style={styles.gridWrapper}>
                    <View style={styles.grid}>
                        {/* Time column */}
                        <View style={[styles.timeColumn, { width: timeColumnWidth }]}>
                            <View style={[styles.cornerCell, { backgroundColor: colors.card, height: 44 }]} />
                            {TIME_SLOTS.map((slot, index) => (
                                <View key={index} style={[styles.timeCell, { backgroundColor: colors.card, height: slotHeight }]}>
                                    <Text style={[styles.timeLabel, { color: colors.tint }]}>{slot.label}</Text>
                                    <Text style={[styles.timeRange, { color: colors.textSecondary }]}>{slot.start}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Day columns */}
                        {DAYS.map((day, dayIndex) => (
                            <View key={day} style={[styles.dayColumn, { width: dayColumnWidth }]}>
                                <View style={[styles.dayHeader, { backgroundColor: colors.card, height: 44 }]}>
                                    <Text style={[styles.dayText, { color: colors.text }]}>{day}</Text>
                                </View>

                                {TIME_SLOTS.map((slot, slotIndex) => {
                                    const selected = getSelectedEntry(dayIndex, slotIndex);
                                    const hasOptions = (availableClasses.get(`${dayIndex}-${slotIndex}`) || []).length > 0;
                                    const isActive = activeSlot?.day === dayIndex && activeSlot?.slot === slotIndex;

                                    return (
                                        <TouchableOpacity
                                            key={slotIndex}
                                            style={[
                                                styles.slotCell,
                                                {
                                                    borderColor: isActive ? colors.tint : colors.cardBorder,
                                                    borderWidth: isActive ? 2 : 0.5,
                                                    height: slotHeight,
                                                    backgroundColor: selected ? getSubjectColor(selected.subject_name) + '40' : 'transparent',
                                                    opacity: activeSlot && !isActive ? 0.4 : 1,
                                                },
                                            ]}
                                            onPress={() => handleSlotPress(dayIndex, slotIndex)}
                                            disabled={!hasOptions && !selected}
                                        >
                                            {selected ? (
                                                <View style={styles.selectedCard}>
                                                    <Text style={styles.selectedSubject} numberOfLines={2}>
                                                        {selected.subject_name}
                                                    </Text>
                                                    <Text style={styles.selectedTeacher} numberOfLines={1}>
                                                        {selected.teacher_name}
                                                    </Text>
                                                    <Text style={styles.selectedRoom} numberOfLines={1}>
                                                        {selected.classroom?.split('-')[0]}
                                                    </Text>
                                                </View>
                                            ) : hasOptions ? (
                                                <View style={styles.emptySlotWithOptions}>
                                                    <FontAwesome name="plus" size={16} color={colors.tint + '40'} />
                                                </View>
                                            ) : null}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>

                    {/* Backdrop to close dropdown */}
                    {activeSlot && (
                        <Pressable
                            style={styles.backdrop}
                            onPress={() => setActiveSlot(null)}
                        />
                    )}

                    {/* Dropdown Cards */}
                    {activeSlot && (() => {
                        // Calculate total dropdown height for upward offset
                        const cardHeight = slotHeight + 4; // card height + margin
                        const buttonHeight = 48; // search button + maybe clear button
                        const hasSelected = getSelectedEntry(activeSlot.day, activeSlot.slot) !== null;
                        const totalCards = displayOptions.length + 1 + (hasSelected ? 1 : 0); // +1 for search button
                        const dropdownHeight = totalCards * cardHeight;

                        // For upward: position so the last card (bottom of dropdown) overlays the clicked cell
                        // Slot 4 (9-10) needs +1px, Slot 5 (11-12) needs -3px adjustment
                        const slotAdjustment = activeSlot.slot === 5 ? -3 : 1;
                        const topOffset = activeSlot.openUpward
                            ? activeSlot.y - (dropdownHeight - cardHeight) + Math.floor(cardHeight / 2) + slotAdjustment
                            : activeSlot.y;

                        return (
                            <View
                                style={[
                                    styles.dropdownContainer,
                                    {
                                        left: activeSlot.x,
                                        width: dayColumnWidth - 4,
                                        top: topOffset,
                                    },
                                ]}
                            >
                                {/* For upward: render search button FIRST, then cards reversed */}
                                {activeSlot.openUpward && (
                                    <>
                                        {/* Search external classes button - at TOP for upward, appears LAST */}
                                        <Animated.View
                                            entering={FadeInUp.delay((displayOptions.length + 1) * 40).duration(200)}
                                            style={{ marginBottom: 4 }}
                                        >
                                            <TouchableOpacity
                                                style={[styles.searchButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint }]}
                                                onPress={() => setShowSearchModal(true)}
                                            >
                                                <FontAwesome name="search" size={12} color={colors.tint} />
                                                <Text style={[styles.searchButtonText, { color: colors.tint }]}>
                                                    Más osztály
                                                </Text>
                                            </TouchableOpacity>
                                        </Animated.View>

                                        {/* Clear button if selected - second */}
                                        {getSelectedEntry(activeSlot.day, activeSlot.slot) && (
                                            <Animated.View
                                                entering={FadeInUp.delay(displayOptions.length * 40).duration(200)}
                                                style={{ marginBottom: 4 }}
                                            >
                                                <TouchableOpacity
                                                    style={[styles.clearButton, { backgroundColor: colors.error + '15', borderColor: colors.error }]}
                                                    onPress={() => selectClass(null)}
                                                >
                                                    <FontAwesome name="trash-o" size={14} color={colors.error} />
                                                </TouchableOpacity>
                                            </Animated.View>
                                        )}

                                        {/* Cards in reverse order - bottom card animates first */}
                                        {[...displayOptions].reverse().map((item, index) => (
                                            <Animated.View
                                                key={item.id}
                                                entering={FadeInUp.delay((displayOptions.length - 1 - index) * 40).duration(200)}
                                                style={{ marginTop: index > 0 ? 4 : 0 }}
                                            >
                                                <TouchableOpacity
                                                    style={[
                                                        styles.classCard,
                                                        {
                                                            backgroundColor: getSubjectColor(item.subject_name) + '40',
                                                            borderColor: getSubjectColor(item.subject_name) + '40',
                                                            height: slotHeight,
                                                        } as any
                                                    ]}
                                                    onPress={() => selectClass(item)}
                                                    activeOpacity={0.85}
                                                >
                                                    <Text style={styles.cardSubject} numberOfLines={2}>
                                                        {item.subject_name}
                                                    </Text>
                                                    <Text style={styles.cardTeacher} numberOfLines={1}>
                                                        {item.teacher_name}
                                                    </Text>
                                                    <View style={styles.cardFooter}>
                                                        <Text style={styles.cardRoom}>
                                                            {item.classroom?.split('-')[0]}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </Animated.View>
                                        ))}
                                    </>
                                )}

                                {/* For downward: normal order - cards first, then buttons */}
                                {!activeSlot.openUpward && (
                                    <>
                                        {displayOptions.map((item, index) => (
                                            <Animated.View
                                                key={item.id}
                                                entering={FadeInDown.delay(index * 40).duration(200)}
                                                style={{ marginTop: index > 0 ? 4 : 0 }}
                                            >
                                                <TouchableOpacity
                                                    style={[
                                                        styles.classCard,
                                                        {
                                                            backgroundColor: getSubjectColor(item.subject_name) + '40',
                                                            borderColor: getSubjectColor(item.subject_name) + '40',
                                                            height: slotHeight,
                                                        } as any
                                                    ]}
                                                    onPress={() => selectClass(item)}
                                                    activeOpacity={0.85}
                                                >
                                                    <Text style={styles.cardSubject} numberOfLines={2}>
                                                        {item.subject_name}
                                                    </Text>
                                                    <Text style={styles.cardTeacher} numberOfLines={1}>
                                                        {item.teacher_name}
                                                    </Text>
                                                    <View style={styles.cardFooter}>
                                                        <Text style={styles.cardRoom}>
                                                            {item.classroom?.split('-')[0]}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </Animated.View>
                                        ))}

                                        {getSelectedEntry(activeSlot.day, activeSlot.slot) && (
                                            <Animated.View
                                                entering={FadeInDown.delay(displayOptions.length * 40).duration(200)}
                                                style={{ marginTop: 4 }}
                                            >
                                                <TouchableOpacity
                                                    style={[styles.clearButton, { backgroundColor: colors.error + '15', borderColor: colors.error }]}
                                                    onPress={() => selectClass(null)}
                                                >
                                                    <FontAwesome name="trash-o" size={14} color={colors.error} />
                                                </TouchableOpacity>
                                            </Animated.View>
                                        )}

                                        {/* Search external classes button */}
                                        <Animated.View
                                            entering={FadeInDown.delay((displayOptions.length + 1) * 40).duration(200)}
                                            style={{ marginTop: 4 }}
                                        >
                                            <TouchableOpacity
                                                style={[styles.searchButton, { backgroundColor: colors.tint + '20', borderColor: colors.tint }]}
                                                onPress={() => setShowSearchModal(true)}
                                            >
                                                <FontAwesome name="search" size={12} color={colors.tint} />
                                                <Text style={[styles.searchButtonText, { color: colors.tint }]}>
                                                    Más osztály
                                                </Text>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    </>
                                )}
                            </View>
                        );
                    })()}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        zIndex: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    countText: {
        fontSize: 13,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    scrollContainer: {
        paddingBottom: 20,
    },
    verticalScroll: {
        // No extra padding needed
    },
    gridWrapper: {
        position: 'relative',
    },
    grid: {
        flexDirection: 'row',
    },
    timeColumn: {},
    cornerCell: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    timeCell: {
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    timeLabel: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    timeRange: {
        fontSize: 10,
        marginTop: 2,
    },
    dayColumn: {},
    dayHeader: {
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    dayText: {
        fontSize: 15,
        fontWeight: '600',
    },
    slotCell: {
        padding: 4,
        borderRadius: 8,
        margin: 2,
    },
    selectedCard: {
        flex: 1,
        justifyContent: 'space-between',
    },
    selectedSubject: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 15,
    },
    selectedTeacher: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 10,
        marginTop: 2,
    },
    selectedRoom: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 10,
        fontWeight: '500',
    },
    emptySlotWithOptions: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5,
    },
    dropdownContainer: {
        position: 'absolute',
        zIndex: 10,
    },
    classCard: {
        borderRadius: 12,
        padding: 10,
        marginBottom: 4,
        justifyContent: 'space-between',
        borderWidth: 1,
        // Frosted glass effect (web only)
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    } as any,
    cardSubject: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 15,
    },
    cardTeacher: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 10,
        marginTop: 3,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    cardRoom: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 10,
        fontWeight: '500',
    },
    clearButton: {
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        marginTop: 4,
    },
    searchButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
});

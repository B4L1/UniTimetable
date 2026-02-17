
// Updated Timetable screen - 2-hour time slots with better layout

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { fetchTimetableEntriesByIds, TimetableEntry } from '@/lib/api';
import { getSubjectColor } from '@/lib/colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// 2-hour time slots (matching the actual schedule)
const TIME_SLOTS = [
  { label: '1-2', start: '08:00', end: '09:50', display: '8:00 - 9:50' },
  { label: '3-4', start: '10:00', end: '11:50', display: '10:00 - 11:50' },
  { label: '5-6', start: '12:30', end: '14:20', display: '12:30 - 14:20' },
  { label: '7-8', start: '14:30', end: '16:20', display: '14:30 - 16:20' },
  { label: '9-10', start: '16:30', end: '18:20', display: '16:30 - 18:20' },
  { label: '11-12', start: '18:30', end: '20:20', display: '18:30 - 20:20' },
];

const DAYS = ['Hé', 'Ke', 'Sz', 'Cs', 'Pé'];

// Map single-hour time to 2-hour slot index
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

// Get current week type (odd or even) based on semester start
function getCurrentWeekType(): 'odd' | 'even' {
  const now = new Date();
  // Assuming semester started on a specific week - adjust as needed
  const semesterStart = new Date(2025, 8, 29); // Sept 29, 2025 (from the timetable footer)
  const weekNumber = Math.ceil(((now.getTime() - semesterStart.getTime()) / 86400000 + 1) / 7);
  return weekNumber % 2 === 1 ? 'odd' : 'even';
}

// Format class name: "Informatika III.C.-14" -> "Informatika III"
function formatClassName(name: string): string {
  // Match pattern: "Faculty Year.Group-Number" and extract just "Faculty Year"
  const match = name.match(/^(.+?)\s+([IVX]+)\./);
  if (match) {
    return `${match[1]} ${match[2]} `;
  }
  return name;
}

// Calculate current time position within the timetable (0-1 range for grid height)
function getCurrentTimePosition(): { slotIndex: number; progress: number } | null {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  // Define slot boundaries in minutes from midnight
  const slots = [
    { start: 8 * 60, end: 9 * 60 + 50 },      // 08:00 - 09:50 (slot 0)
    { start: 10 * 60, end: 11 * 60 + 50 },    // 10:00 - 11:50 (slot 1)
    { start: 12 * 60 + 30, end: 14 * 60 + 20 }, // 12:30 - 14:20 (slot 2)
    { start: 14 * 60 + 30, end: 16 * 60 + 20 }, // 14:30 - 16:20 (slot 3)
    { start: 16 * 60 + 30, end: 18 * 60 + 20 }, // 16:30 - 18:20 (slot 4)
    { start: 18 * 60 + 30, end: 20 * 60 + 20 }, // 18:30 - 20:20 (slot 5)
  ];

  // Find which slot we're in, or between
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (currentMinutes >= slot.start && currentMinutes <= slot.end) {
      // Within this slot
      const progress = (currentMinutes - slot.start) / (slot.end - slot.start);
      return { slotIndex: i, progress };
    }
    // Check if we're before first slot
    if (i === 0 && currentMinutes < slot.start) {
      return null; // Before school day
    }
    // Check if we're between slots
    if (i < slots.length - 1) {
      const nextSlot = slots[i + 1];
      if (currentMinutes > slot.end && currentMinutes < nextSlot.start) {
        // Between slots - show at end of current slot
        return { slotIndex: i, progress: 1 };
      }
    }
  }

  // After last slot
  if (currentMinutes > slots[slots.length - 1].end) {
    return null; // After school day
  }

  return null;
}

export default function TimetableScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { selectedClass, userSelections } = useAppStore();
  const { colors } = useTheme();

  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timePosition, setTimePosition] = useState(getCurrentTimePosition());

  const today = new Date().getDay() - 1; // 0 = Monday
  const currentWeekType = getCurrentWeekType();

  // Update time position every minute
  useEffect(() => {
    const updateTime = () => setTimePosition(getCurrentTimePosition());
    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate column width based on screen size
  const timeColumnWidth = 70;
  const availableWidth = width - timeColumnWidth;
  const dayColumnWidth = Math.max(140, availableWidth / 5);
  const slotHeight = 100; // Taller slots for 2-hour blocks

  // Load timetable data - only shows user-selected entries
  const loadTimetable = useCallback(async (showLoader = true) => {
    console.log('loadTimetable called, userSelections:', userSelections);
    if (!selectedClass?.id) return;

    if (showLoader) setLoading(true);

    try {
      let data: TimetableEntry[] = [];

      // Only fetch user-selected entries (no fallback to group schedule)
      if (userSelections.length > 0) {
        console.log('Fetching entries by IDs:', userSelections);
        data = await fetchTimetableEntriesByIds(userSelections);
        console.log('Fetched data:', data);
      } else {
        console.log('No user selections - setting entries to empty array');
      }

      console.log('Setting entries to:', data.length, 'items');
      setEntries(data);
    } catch (err) {
      console.error('Failed to load timetable:', err);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClass?.id, userSelections]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  // Refetch when tab becomes focused (after saving in planner)
  useFocusEffect(
    useCallback(() => {
      console.log('Tab focused! userSelections.length:', userSelections.length);
      loadTimetable(false);
    }, [userSelections.length, loadTimetable])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTimetable(false);
  }, [loadTimetable]);

  // Get entries for a 2-hour slot
  const getEntriesForSlot = (dayIndex: number, slotIndex: number): TimetableEntry[] => {
    return entries.filter(e => {
      const entrySlot = getSlotIndex(e.start_time);
      return e.day_of_week === dayIndex && entrySlot === slotIndex;
    });
  };

  if (!selectedClass) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <FontAwesome name="calendar-o" size={48} color={colors.tint} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nincs kiválasztott órarend</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            A kezdéshez válassz egy szakot és csoportot.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.buttonText}>Kiválasztás</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Background is now global via BackgroundWrapper in RootLayout */}

      {/* Header with class info and week indicator */}
      <View style={[styles.header, { backgroundColor: colors.card + 'E6', borderBottomColor: colors.cardBorder }]}>
        <Text style={[styles.className, { color: colors.text }]}>
          {formatClassName(selectedClass.name)}
        </Text>
        <View style={[styles.weekBadge, { backgroundColor: colors.tint + '20' }]}>
          <Text style={[styles.weekText, { color: colors.tint }]}>
            {currentWeekType === 'odd' ? 'Páratlan hét' : 'Páros hét'}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
      >
        <View style={styles.grid}>
          {/* Time column */}
          <View style={[styles.timeColumn, { width: timeColumnWidth }]}>
            <View style={[styles.cornerCell, { backgroundColor: colors.card + 'CC', height: 50 }]} />
            {TIME_SLOTS.map((slot, index) => (
              <View key={index} style={[styles.timeCell, { backgroundColor: colors.card + 'B3', height: slotHeight }]}>
                <Text style={[styles.timeLabel, { color: colors.tint }]}>{slot.label}</Text>
                <Text style={[styles.timeRange, { color: colors.textSecondary }]}>
                  {slot.start}
                </Text>
                <Text style={[styles.timeRange, { color: colors.textSecondary }]}>
                  {slot.end}
                </Text>
              </View>
            ))}
          </View>

          {/* Day columns */}
          {DAYS.map((day, dayIndex) => (
            <View
              key={day}
              style={[
                styles.dayColumn,
                { width: dayColumnWidth },
              ]}
            >
              {/* Day header */}
              <View style={[
                styles.dayHeader,
                {
                  backgroundColor: dayIndex === today ? colors.tint + 'E6' : colors.card + 'CC',
                  borderBottomColor: colors.cardBorder,
                  height: 50,
                }
              ]}>
                <Text style={[
                  styles.dayText,
                  { color: dayIndex === today ? '#fff' : colors.text }
                ]}>
                  {day}
                </Text>
                {dayIndex === today && (
                  <Text style={styles.todayLabel}>Ma</Text>
                )}
              </View>

              {/* Time slots */}
              {TIME_SLOTS.map((slot, slotIndex) => {
                const slotEntries = getEntriesForSlot(dayIndex, slotIndex);

                // Filter for current week
                const currentEntries = slotEntries.filter(e =>
                  e.week_type === 'all' || e.week_type === currentWeekType
                );

                return (
                  <View
                    key={slotIndex}
                    style={[
                      styles.slotCell,
                      {
                        borderColor: colors.cardBorder,
                        height: slotHeight,
                        position: 'relative',
                        backgroundColor: dayIndex === today ? colors.tint + '08' : 'transparent',
                      },
                    ]}
                  >
                    {currentEntries.length > 0 ? (
                      currentEntries.map((entry, idx) => (
                        <View
                          key={entry.id || idx}
                          style={[
                            styles.classCard,
                            {
                              backgroundColor: getSubjectColor(entry.subject_name) + '40', // 25% opacity
                              borderColor: getSubjectColor(entry.subject_name) + '40', // 25% opacity border
                            } as any,
                          ]}
                        >
                          <Text style={styles.subjectName} numberOfLines={2}>
                            {entry.subject_name}
                          </Text>
                          <Text style={styles.teacherName} numberOfLines={1}>
                            {entry.teacher_name || entry.teacher_code}
                          </Text>
                          <View style={styles.cardFooter}>
                            <Text style={styles.roomText} numberOfLines={1}>
                              {entry.classroom?.split('-')[0]?.trim()}
                            </Text>
                            {entry.week_type !== 'all' && (
                              <View style={styles.weekIndicator}>
                                <Text style={styles.weekIndicatorText}>
                                  {entry.week_type === 'odd' ? '1' : '2'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptySlot} />
                    )}

                    {/* Time indicator line - only on today's column and current slot */}
                    {dayIndex === today &&
                      preferences.showTimeIndicator &&
                      timePosition &&
                      timePosition.slotIndex === slotIndex && (
                        <View
                          style={[
                            styles.timeIndicatorLine,
                            {
                              backgroundColor: colors.timeIndicator || '#ef4444',
                              top: `${timePosition.progress * 100}% `,
                            }
                          ]}
                        />
                      )}
                  </View>
                );
              })}
            </View>
          ))}
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
  noClassText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
  },
  weekBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  weekText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeColumn: {
    // width set dynamically
  },
  cornerCell: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  timeCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 4,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeRange: {
    fontSize: 10,
    marginTop: 1,
  },
  dayColumn: {
    // width set dynamically
    flex: 1,
    alignSelf: 'stretch',
  },
  dayHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  todayLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
  slotCell: {
    borderWidth: 0.5,
    padding: 3,
  },
  classCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
    minHeight: 0,
    borderWidth: 1,
    // Frosted glass effect (web only)
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  } as any,
  subjectName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
    flexShrink: 1,
  },
  teacherName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  roomText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  weekIndicator: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  weekIndicatorText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptySlot: {
    flex: 1,
  },
  timeIndicatorLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 10,
    // Optional: add a small circle on the left
    borderRadius: 1,
  },
  // New empty state styles
  emptyCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    width: '90%',
    maxWidth: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

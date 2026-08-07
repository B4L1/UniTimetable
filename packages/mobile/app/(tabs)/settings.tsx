import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/stores/appStore';
import {
    fetchClasses, fetchTimetableEntries,
    getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass,
    ClassData,
} from '@unitimetable/shared';
import { syncWidget } from '@/widget/widget-sync';
import { palette, radius, fonts } from '@/constants/theme';

export default function SettingsScreen() {
    const { selectedClass, setSelectedClass, setTimetableEntries } = useAppStore();

    const [classes, setClasses] = useState<ClassData[]>([]);
    const [loading, setLoading] = useState(false);
    const [showPicker, setShowPicker] = useState(false);

    const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

    // Load classes when picker is opened
    const openPicker = async () => {
        setShowPicker(true);
        if (classes.length === 0) {
            setLoading(true);
            try {
                const data = await fetchClasses();
                setClasses(data);
            } catch (err) {
                Alert.alert('Hiba', 'Nem sikerült betölteni az osztályokat.');
            } finally {
                setLoading(false);
            }
        }
    };

    // Reset dependent selections
    useEffect(() => {
        setSelectedYear(null);
        setSelectedGroup(null);
    }, [selectedFaculty]);

    useEffect(() => {
        setSelectedGroup(null);
    }, [selectedYear]);

    const faculties = getUniqueFaculties(classes);
    const years = selectedFaculty ? getYearsForFaculty(classes, selectedFaculty) : [];
    const groups = selectedFaculty && selectedYear
        ? getGroupsForFacultyYear(classes, selectedFaculty, selectedYear)
        : [];

    const handleSelectGroup = async (group: string) => {
        if (!selectedFaculty || !selectedYear) return;

        const classData = findClass(classes, selectedFaculty, selectedYear, group);
        if (!classData) return;

        await setSelectedClass({
            id: classData.id,
            name: classData.name,
            faculty: classData.faculty || '',
            year: classData.year,
            groupCode: classData.group_code || '',
        });

        // Fetch timetable for the new class (and refresh the widget)
        const entries = await fetchTimetableEntries(classData.id);
        setTimetableEntries(entries);
        syncWidget(entries);

        setShowPicker(false);
        setSelectedFaculty(null);
        setSelectedYear(null);
        setSelectedGroup(null);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <Text style={styles.title}>Beállítások</Text>

                {/* Current class */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>CSOPORT</Text>
                    <TouchableOpacity style={styles.card} onPress={openPicker}>
                        <View>
                            <Text style={styles.cardLabel}>
                                {selectedClass ? 'Jelenlegi csoport' : 'Válassz csoportot'}
                            </Text>
                            {selectedClass && (
                                <Text style={styles.cardValue}>{selectedClass.name}</Text>
                            )}
                        </View>
                        <Text style={styles.cardArrow}>
                            {showPicker ? '▼' : '→'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Class picker */}
                {showPicker && (
                    <View style={styles.pickerContainer}>
                        {loading ? (
                            <ActivityIndicator size="small" color={palette.accent} style={{ padding: 24 }} />
                        ) : (
                            <>
                                {/* Faculty */}
                                <Text style={styles.pickerLabel}>Szak</Text>
                                <View style={styles.optionsGrid}>
                                    {faculties.map((f) => (
                                        <TouchableOpacity
                                            key={f}
                                            style={[
                                                styles.optionChip,
                                                selectedFaculty === f && styles.optionChipActive,
                                            ]}
                                            onPress={() => setSelectedFaculty(f)}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionText,
                                                    selectedFaculty === f && styles.optionTextActive,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {f}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Year */}
                                {selectedFaculty && years.length > 0 && (
                                    <>
                                        <Text style={styles.pickerLabel}>Évfolyam</Text>
                                        <View style={styles.optionsRow}>
                                            {years.map((y) => (
                                                <TouchableOpacity
                                                    key={y}
                                                    style={[
                                                        styles.yearChip,
                                                        selectedYear === y && styles.optionChipActive,
                                                    ]}
                                                    onPress={() => setSelectedYear(y)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.yearText,
                                                            selectedYear === y && styles.optionTextActive,
                                                        ]}
                                                    >
                                                        {y}. év
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}

                                {/* Group */}
                                {selectedYear && groups.length > 0 && (
                                    <>
                                        <Text style={styles.pickerLabel}>Csoport</Text>
                                        <View style={styles.optionsRow}>
                                            {groups.map((g) => (
                                                <TouchableOpacity
                                                    key={g}
                                                    style={[
                                                        styles.groupChip,
                                                        selectedGroup === g && styles.optionChipActive,
                                                    ]}
                                                    onPress={() => handleSelectGroup(g)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.groupText,
                                                            selectedGroup === g && styles.optionTextActive,
                                                        ]}
                                                    >
                                                        {g}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                            </>
                        )}
                    </View>
                )}

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>NÉVJEGY</Text>
                    <View style={styles.aboutCard}>
                        <Text style={styles.aboutTitle}>UniTimetable</Text>
                        <Text style={styles.aboutVersion}>v1.0.0</Text>
                        <Text style={styles.aboutDescription}>
                            Egyetemi órarend alkalmazás{'\n'}Sapientia EMTE
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.bgApp,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        marginBottom: 24,
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: fonts.sansBold,
        color: palette.textTertiary,
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    card: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    cardLabel: {
        fontSize: 14,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
    },
    cardValue: {
        fontSize: 17,
        fontFamily: fonts.sansSemiBold,
        color: palette.textPrimary,
        marginTop: 4,
    },
    cardArrow: {
        fontSize: 16,
        color: palette.textTertiary,
    },
    // Picker
    pickerContainer: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        padding: 16,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    pickerLabel: {
        fontSize: 13,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
        marginBottom: 10,
        marginTop: 16,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    optionChip: {
        backgroundColor: palette.bgElevated,
        borderRadius: radius.sm,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: palette.borderDefault,
        borderLeftWidth: 1,
    },
    optionChipActive: {
        borderLeftWidth: 2,
        borderLeftColor: palette.accent,
    },
    optionText: {
        fontSize: 14,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
    },
    optionTextActive: {
        color: palette.accent,
        fontFamily: fonts.sansSemiBold,
    },
    yearChip: {
        flex: 1,
        backgroundColor: palette.bgElevated,
        borderRadius: radius.sm,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
        borderLeftWidth: 1,
    },
    yearText: {
        fontSize: 16,
        fontFamily: fonts.sansSemiBold,
        color: palette.textSecondary,
    },
    groupChip: {
        flex: 1,
        backgroundColor: palette.bgElevated,
        borderRadius: radius.sm,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
        borderLeftWidth: 1,
    },
    groupText: {
        fontSize: 20,
        fontFamily: fonts.sansBold,
        color: palette.textSecondary,
    },
    // About
    aboutCard: {
        backgroundColor: palette.bgSurface,
        borderRadius: radius.md,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.borderDefault,
    },
    aboutTitle: {
        fontSize: 20,
        fontFamily: fonts.sansBold,
        color: palette.textPrimary,
        marginBottom: 4,
    },
    aboutVersion: {
        fontSize: 14,
        fontFamily: fonts.mono,
        color: palette.textTertiary,
        marginBottom: 12,
    },
    aboutDescription: {
        fontSize: 14,
        fontFamily: fonts.sans,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});

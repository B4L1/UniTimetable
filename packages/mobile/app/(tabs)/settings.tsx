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
                            <ActivityIndicator size="small" color="#818cf8" style={{ padding: 24 }} />
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
        backgroundColor: '#12121a',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 24,
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    cardLabel: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    cardValue: {
        fontSize: 17,
        fontWeight: '600',
        color: '#ffffff',
        marginTop: 4,
    },
    cardArrow: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.3)',
    },
    // Picker
    pickerContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.2)',
    },
    pickerLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
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
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    optionChipActive: {
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        borderColor: '#6366f1',
    },
    optionText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    optionTextActive: {
        color: '#818cf8',
        fontWeight: '600',
    },
    yearChip: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    yearText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    groupChip: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 10,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    groupText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    // About
    aboutCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    aboutTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 4,
    },
    aboutVersion: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.4)',
        marginBottom: 12,
    },
    aboutDescription: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        lineHeight: 20,
    },
});

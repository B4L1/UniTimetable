import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppStore } from '@/stores/appStore';
import Colors from '@/constants/Colors';
import { AnimatedStep } from '../components/AnimatedStep';
import {
    fetchClasses,
    getUniqueFaculties,
    getYearsForFaculty,
    getGroupsForFacultyYear,
    findClass,
    ClassData,
} from '@unitimetable/shared';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { setSelectedClass, setFirstLaunchComplete, preferences } = useAppStore();

    const [classes, setClasses] = useState<ClassData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

    const scrollViewRef = useRef<ScrollView>(null);

    const isDark = preferences.theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    // Fetch classes on mount
    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchClasses();
            if (data.length === 0) {
                setError('Nem sikerült betölteni az adatokat. Ellenőrizze az internetkapcsolatot.');
            } else {
                setClasses(data);
            }
        } catch (err) {
            setError('Hálózati hiba. Kérjük, próbálja újra.');
        } finally {
            setLoading(false);
        }
    };

    // Derived state
    const faculties = getUniqueFaculties(classes);
    const years = selectedFaculty ? getYearsForFaculty(classes, selectedFaculty) : [];
    const groups = selectedFaculty && selectedYear
        ? getGroupsForFacultyYear(classes, selectedFaculty, selectedYear)
        : [];

    // Reset logic when selection changes
    const handleSelectFaculty = (faculty: string) => {
        setSelectedFaculty(faculty);
        setSelectedYear(null);
        setSelectedGroup(null);
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const handleSelectYear = (year: number) => {
        setSelectedYear(year);
        setSelectedGroup(null);
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const handleSelectGroup = async (group: string) => {
        setSelectedGroup(group);

        // Auto-complete if valid
        if (selectedFaculty && selectedYear) {
            const classData = findClass(classes, selectedFaculty, selectedYear, group);
            if (classData) {
                // Short delay for visual feedback
                setTimeout(async () => {
                    await setSelectedClass({
                        id: classData.id,
                        name: classData.name,
                        faculty: classData.faculty || '',
                        year: classData.year,
                        groupCode: classData.group_code || '',
                    });
                    await setFirstLaunchComplete();
                    router.replace('/(tabs)');
                }, 500);
            }
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#818cf8" />
                <Text style={styles.loadingText}>Adatok betöltése...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, styles.centered]}>
                <StatusBar style="light" />
                <Text style={styles.errorEmoji}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadClasses}>
                    <Text style={styles.retryButtonText}>Újrapróbálkozás</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.logo}>🎓</Text>
                    <Text style={styles.title}>Üdvözöllek!</Text>
                    <Text style={styles.subtitle}>
                        Állítsuk be az órarendedet.
                    </Text>
                </View>

                {/* Step 1: Faculty */}
                <AnimatedStep visible={true} delay={300}>
                    <Text style={styles.sectionTitle}>Válassz kart</Text>
                    <View style={styles.grid}>
                        {faculties.map((faculty) => (
                            <TouchableOpacity
                                key={faculty}
                                style={[
                                    styles.card,
                                    selectedFaculty === faculty && styles.cardSelected,
                                ]}
                                onPress={() => handleSelectFaculty(faculty)}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={selectedFaculty === faculty ? ['#6366f1', '#4f46e5'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                                    style={styles.cardGradient}
                                >
                                    <Text style={[
                                        styles.cardText,
                                        selectedFaculty === faculty && styles.cardTextSelected
                                    ]}>{faculty}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </View>
                </AnimatedStep>

                {/* Step 2: Year */}
                <AnimatedStep visible={!!selectedFaculty} delay={100}>
                    {selectedFaculty && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Válassz évfolyamot</Text>
                            <View style={styles.row}>
                                {years.map((year) => (
                                    <TouchableOpacity
                                        key={year}
                                        style={[
                                            styles.yearCard,
                                            selectedYear === year && styles.cardSelected,
                                        ]}
                                        onPress={() => handleSelectYear(year)}
                                        activeOpacity={0.7}
                                    >
                                        <LinearGradient
                                            colors={selectedYear === year ? ['#8b5cf6', '#7c3aed'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                                            style={styles.cardGradient}
                                        >
                                            <Text style={[
                                                styles.yearText,
                                                selectedYear === year && styles.cardTextSelected
                                            ]}>{year}.</Text>
                                            <Text style={[
                                                styles.yearLabel,
                                                selectedYear === year && styles.cardTextSelected
                                            ]}>évfolyam</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </AnimatedStep>

                {/* Step 3: Group */}
                <AnimatedStep visible={!!selectedYear} delay={100}>
                    {selectedYear && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Válassz csoportot</Text>
                            <View style={styles.grid}>
                                {groups.map((group) => (
                                    <TouchableOpacity
                                        key={group}
                                        style={[
                                            styles.card,
                                            selectedGroup === group && styles.cardSelected,
                                        ]}
                                        onPress={() => handleSelectGroup(group)}
                                        activeOpacity={0.7}
                                    >
                                        <LinearGradient
                                            colors={selectedGroup === group ? ['#ec4899', '#db2777'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                                            style={styles.cardGradient}
                                        >
                                            <Text style={[
                                                styles.groupText,
                                                selectedGroup === group && styles.cardTextSelected
                                            ]}>{group}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </AnimatedStep>

                {/* Bottom padding for scroll */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f23',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0f23',
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: 16,
        fontSize: 16,
    },
    errorEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 32,
    },
    retryButton: {
        backgroundColor: '#818cf8',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    scrollContent: {
        padding: 24,
        paddingTop: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },
    sectionContainer: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    card: {
        width: '48%', // Approx half width
        aspectRatio: 1.5,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    yearCard: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: 16, // Circle-ish
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
    },
    cardSelected: {
        borderColor: 'transparent',
        transform: [{ scale: 1.02 }],
    },
    cardText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
    },
    yearText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.8)',
    },
    yearLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 4,
    },
    groupText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.8)',
    },
    cardTextSelected: {
        color: '#fff',
    },
});

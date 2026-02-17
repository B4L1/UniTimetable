// Updated Onboarding screen - Fetches real classes from Supabase

import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useAppStore } from '@/stores/appStore';
import Colors from '@/constants/Colors';
import {
    fetchClasses,
    getUniqueFaculties,
    getYearsForFaculty,
    getGroupsForFacultyYear,
    findClass,
    ClassData,
} from '@/lib/api';

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
                setError('Nem sikerült betölteni az osztályokat. Kérjük, próbálja újra.');
            } else {
                setClasses(data);
            }
        } catch (err) {
            setError('Hálózati hiba. Ellenőrizze az internetkapcsolatot.');
        } finally {
            setLoading(false);
        }
    };

    // Get available options based on selections
    const faculties = getUniqueFaculties(classes);
    const years = selectedFaculty ? getYearsForFaculty(classes, selectedFaculty) : [];
    const groups = selectedFaculty && selectedYear
        ? getGroupsForFacultyYear(classes, selectedFaculty, selectedYear)
        : [];

    // Reset dependent selections when parent changes
    useEffect(() => {
        setSelectedYear(null);
        setSelectedGroup(null);
    }, [selectedFaculty]);

    useEffect(() => {
        setSelectedGroup(null);
    }, [selectedYear]);

    const handleContinue = async () => {
        if (selectedFaculty && selectedYear && selectedGroup) {
            const classData = findClass(classes, selectedFaculty, selectedYear, selectedGroup);

            if (classData) {
                await setSelectedClass({
                    id: classData.id,
                    name: classData.name,
                    faculty: classData.faculty || '',
                    year: classData.year,
                    groupCode: classData.group_code || '',
                });
                await setFirstLaunchComplete();
                router.replace('/(tabs)');
            }
        }
    };

    const canContinue = selectedFaculty && selectedYear && selectedGroup;

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.tint} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Osztályok betöltése...
                </Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: colors.tint }]}
                    onPress={loadClasses}
                >
                    <Text style={styles.retryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Animated.View entering={FadeInDown.delay(100).springify()}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {t('onboarding.welcome')}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {t('onboarding.subtitle')}
                    </Text>
                </Animated.View>

                {/* Faculty Selection */}
                <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('onboarding.selectFaculty')}
                    </Text>
                    <View style={styles.optionsGrid}>
                        {faculties.map((faculty) => (
                            <TouchableOpacity
                                key={faculty}
                                style={[
                                    styles.optionCard,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: selectedFaculty === faculty ? colors.tint : colors.cardBorder,
                                        borderWidth: selectedFaculty === faculty ? 2 : 1,
                                    },
                                ]}
                                onPress={() => setSelectedFaculty(faculty)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    { color: selectedFaculty === faculty ? colors.tint : colors.text }
                                ]}>
                                    {faculty}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>

                {/* Year Selection */}
                {selectedFaculty && years.length > 0 && (
                    <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                            {t('onboarding.selectYear')}
                        </Text>
                        <View style={styles.optionsRow}>
                            {years.map((year) => (
                                <TouchableOpacity
                                    key={year}
                                    style={[
                                        styles.yearCard,
                                        {
                                            backgroundColor: colors.card,
                                            borderColor: selectedYear === year ? colors.tint : colors.cardBorder,
                                            borderWidth: selectedYear === year ? 2 : 1,
                                        },
                                    ]}
                                    onPress={() => setSelectedYear(year)}
                                >
                                    <Text style={[
                                        styles.yearText,
                                        { color: selectedYear === year ? colors.tint : colors.text }
                                    ]}>
                                        {year}. év
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                )}

                {/* Group Selection */}
                {selectedYear && groups.length > 0 && (
                    <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                            {t('onboarding.selectGroup')}
                        </Text>
                        <View style={styles.optionsRow}>
                            {groups.map((group) => (
                                <TouchableOpacity
                                    key={group}
                                    style={[
                                        styles.groupCard,
                                        {
                                            backgroundColor: colors.card,
                                            borderColor: selectedGroup === group ? colors.tint : colors.cardBorder,
                                            borderWidth: selectedGroup === group ? 2 : 1,
                                        },
                                    ]}
                                    onPress={() => setSelectedGroup(group)}
                                >
                                    <Text style={[
                                        styles.groupText,
                                        { color: selectedGroup === group ? colors.tint : colors.text }
                                    ]}>
                                        {group}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                )}
            </ScrollView>

            {/* Continue Button */}
            <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.continueButton,
                        {
                            backgroundColor: canContinue ? colors.tint : colors.cardBorder,
                        },
                    ]}
                    onPress={handleContinue}
                    disabled={!canContinue}
                >
                    <Text style={[styles.continueText, { opacity: canContinue ? 1 : 0.5 }]}>
                        {t('onboarding.continue')}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
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
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginHorizontal: 32,
        marginBottom: 24,
    },
    retryButton: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
    },
    retryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 24,
        paddingTop: 80,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    optionCard: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        minWidth: '45%',
        flex: 1,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    yearCard: {
        flex: 1,
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    yearText: {
        fontSize: 18,
        fontWeight: '600',
    },
    groupCard: {
        flex: 1,
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    groupText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    footer: {
        padding: 24,
        paddingBottom: 40,
    },
    continueButton: {
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    continueText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});

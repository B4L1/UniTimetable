// Settings Screen

import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Switch, Alert, Modal, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { useAppStore, BackgroundTheme } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import i18n from '@/i18n';
import { fetchTimetableEntries } from '@/lib/api';

const BACKGROUND_THEMES: { id: BackgroundTheme; label: string; icon: string }[] = [
    { id: 'none', label: 'Nincs', icon: '🚫' },
    { id: 'silk', label: 'Silk', icon: '🧵' },
    { id: 'aurora', label: 'Aurora', icon: '🌌' },
    { id: 'plasma', label: 'Plasma', icon: '🔮' },
    { id: 'pixel-blast', label: 'Pixel Blast', icon: '👾' },
    { id: 'beams', label: 'Beams', icon: '✨' },
    { id: 'dither', label: 'Dither', icon: '📺' },
    { id: 'faulty-terminal', label: 'Faulty Terminal', icon: '💻' },
    { id: 'iridescence', label: 'Iridescence', icon: '🌈' },
    { id: 'liquid-chrome', label: 'Liquid Chrome', icon: '💎' },
];

export default function SettingsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { preferences, updatePreferences, selectedClass, setTimetableEntries, userSelections, clearSelections } = useAppStore();

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showBackgroundDropdown, setShowBackgroundDropdown] = useState(false);

    const { colors, isDark } = useTheme();

    const handleThemeToggle = () => {
        updatePreferences({ theme: isDark ? 'light' : 'dark' });
    };

    const handleTimeIndicatorToggle = () => {
        updatePreferences({ showTimeIndicator: !preferences.showTimeIndicator });
    };

    const handleLanguageChange = (lang: 'hu' | 'en') => {
        updatePreferences({ language: lang });
        i18n.changeLanguage(lang);
    };

    const handleRefreshData = async () => {
        if (!selectedClass?.id) {
            Alert.alert('Hiba', 'Nincs kiválasztott osztály.');
            return;
        }
        try {
            const data = await fetchTimetableEntries(selectedClass.id);
            setTimetableEntries(data);
            Alert.alert('Siker', 'Az órarend frissítve!');
        } catch (err) {
            Alert.alert('Hiba', 'Nem sikerült frissíteni az adatokat.');
        }
    };

    const handleClearSelections = () => {
        if (userSelections.length === 0) {
            alert('Nincs mentett óra - A tervező üres.');
            return;
        }
        setShowConfirmModal(true);
    };

    const confirmClearSelections = async () => {
        console.log('Deleting selections...');
        await clearSelections();
        console.log('Selections cleared!');
        setShowConfirmModal(false);
    };

    const SettingRow = ({
        icon,
        label,
        value,
        onPress,
        hasSwitch,
        switchValue,
        onSwitchChange,
        destructive,
    }: {
        icon: string;
        label: string;
        value?: string;
        onPress?: () => void;
        hasSwitch?: boolean;
        switchValue?: boolean;
        onSwitchChange?: (val: boolean) => void;
        destructive?: boolean;
    }) => (
        <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: colors.cardBorder }]}
            onPress={onPress}
            disabled={hasSwitch}
        >
            <View style={styles.settingLeft}>
                <FontAwesome name={icon as any} size={18} color={destructive ? colors.error : colors.textSecondary} style={styles.icon} />
                <Text style={[styles.settingLabel, { color: destructive ? colors.error : colors.text }]}>{label}</Text>
            </View>
            {hasSwitch ? (
                <Switch
                    value={switchValue}
                    onValueChange={onSwitchChange}
                    trackColor={{ false: colors.cardBorder, true: colors.tint }}
                    thumbColor="#fff"
                />
            ) : (
                <View style={styles.settingRight}>
                    <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>
                    <FontAwesome name="chevron-right" size={12} color={colors.textSecondary} />
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <>
            <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Appearance Section */}
                <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.appearance')}
                    </Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingRow
                            icon="moon-o"
                            label={t('settings.darkMode')}
                            hasSwitch
                            switchValue={isDark}
                            onSwitchChange={handleThemeToggle}
                        />
                        <SettingRow
                            icon="clock-o"
                            label={t('settings.timeIndicator')}
                            hasSwitch
                            switchValue={preferences.showTimeIndicator}
                            onSwitchChange={handleTimeIndicatorToggle}
                        />
                    </View>
                </Animated.View>

                {/* Background Theme Section */}
                <Animated.View entering={FadeInDown.delay(150)} style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        Háttér
                    </Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <TouchableOpacity
                            style={[styles.settingRow, { borderBottomColor: colors.cardBorder }]}
                            onPress={() => setShowBackgroundDropdown(!showBackgroundDropdown)}
                        >
                            <View style={styles.settingLeft}>
                                <FontAwesome name="paint-brush" size={18} color={colors.textSecondary} style={styles.icon} />
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Háttér téma</Text>
                            </View>
                            <View style={styles.settingRight}>
                                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                                    {BACKGROUND_THEMES.find(t => t.id === preferences.backgroundTheme)?.label || 'Nincs'}
                                </Text>
                                <FontAwesome
                                    name={showBackgroundDropdown ? "chevron-up" : "chevron-down"}
                                    size={12}
                                    color={colors.textSecondary}
                                />
                            </View>
                        </TouchableOpacity>
                        {showBackgroundDropdown && (
                            <Animated.View entering={FadeIn.duration(200)}>
                                {BACKGROUND_THEMES.map((theme) => (
                                    <TouchableOpacity
                                        key={theme.id}
                                        style={[
                                            styles.dropdownOption,
                                            preferences.backgroundTheme === theme.id && { backgroundColor: colors.tint + '20' }
                                        ]}
                                        onPress={() => {
                                            updatePreferences({ backgroundTheme: theme.id as any });
                                            setShowBackgroundDropdown(false);
                                        }}
                                    >
                                        <Text style={[styles.languageText, { color: colors.text }]}>
                                            {theme.icon} {theme.label}
                                        </Text>
                                        {preferences.backgroundTheme === theme.id && (
                                            <FontAwesome name="check" size={16} color={colors.tint} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </Animated.View>
                        )}
                    </View>
                </Animated.View>
                {/* Language Section */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.language')}
                    </Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <TouchableOpacity
                            style={[
                                styles.languageOption,
                                preferences.language === 'hu' && { backgroundColor: colors.tint + '20' }
                            ]}
                            onPress={() => handleLanguageChange('hu')}
                        >
                            <Text style={[styles.languageText, { color: colors.text }]}>🇭🇺 Magyar</Text>
                            {preferences.language === 'hu' && (
                                <FontAwesome name="check" size={16} color={colors.tint} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.languageOption,
                                preferences.language === 'en' && { backgroundColor: colors.tint + '20' }
                            ]}
                            onPress={() => handleLanguageChange('en')}
                        >
                            <Text style={[styles.languageText, { color: colors.text }]}>🇬🇧 English</Text>
                            {preferences.language === 'en' && (
                                <FontAwesome name="check" size={16} color={colors.tint} />
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Data Section */}
                <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.data')}
                    </Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingRow
                            icon="refresh"
                            label={t('settings.refreshData')}
                            value=""
                            onPress={handleRefreshData}
                        />
                        <SettingRow
                            icon="exchange"
                            label={t('settings.changeClass')}
                            value=""
                            onPress={() => router.push('/onboarding')}
                        />
                        {/* Delete button - using direct TouchableOpacity for reliable click handling */}
                        <TouchableOpacity
                            style={[styles.settingRow, { borderBottomColor: colors.cardBorder }]}
                            onPress={handleClearSelections}
                        >
                            <View style={styles.settingLeft}>
                                <FontAwesome name="trash-o" size={18} color={colors.error} style={styles.icon} />
                                <Text style={[styles.settingLabel, { color: colors.error }]}>Tervező törlése</Text>
                            </View>
                            <View style={styles.settingRight}>
                                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{userSelections.length} óra</Text>
                                <FontAwesome name="chevron-right" size={12} color={colors.textSecondary} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* About Section */}
                <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.about')}
                    </Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingRow
                            icon="info-circle"
                            label={t('settings.version')}
                            value="1.0.0"
                        />
                    </View>
                </Animated.View>

                <View style={styles.spacer} />
            </ScrollView>

            {/* Confirmation Modal */}
            <Modal
                visible={showConfirmModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowConfirmModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowConfirmModal(false)}
                >
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        style={[styles.modalContent, { backgroundColor: colors.card }]}
                    >
                        <View style={styles.modalHeader}>
                            <FontAwesome name="trash-o" size={32} color={colors.error} />
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                Tervező törlése
                            </Text>
                        </View>
                        <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                            Biztosan törölni szeretnéd a {userSelections.length} mentett órát?
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.cardBorder }]}
                                onPress={() => setShowConfirmModal(false)}
                            >
                                <Text style={[styles.buttonText, { color: colors.text }]}>Mégse</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.deleteButton, { backgroundColor: colors.error }]}
                                onPress={confirmClearSelections}
                            >
                                <Text style={[styles.buttonText, { color: '#fff' }]}>Törlés</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        width: 24,
        textAlign: 'center',
    },
    settingLabel: {
        fontSize: 16,
        marginLeft: 12,
    },
    settingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    settingValue: {
        fontSize: 14,
    },
    languageOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    languageText: {
        fontSize: 16,
    },
    dropdownOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        paddingLeft: 44,
    },
    spacer: {
        height: 40,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 12,
    },
    modalMessage: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButton: {
        borderWidth: 1,
    },
    deleteButton: {
        // backgroundColor set dynamically
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

// Settings component for web

import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { googleLogout } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass } from '@shared/index';
import type { ClassData, ColorTheme, BackgroundEffect } from '@shared/lib/types';
import { useBackgroundEffect, setBackgroundEffect, prefersReducedMotion } from '../utils/backgroundEffect';
import { showToast } from '../stores/toastStore';
import { confirmDialog } from '../stores/confirmStore';

// 'Sötét üveg' (dark-glass) is gone — the frosted look was retired in the v4
// redesign, and anyone still on it is migrated to plain dark on load.
const COLOR_THEMES: { id: ColorTheme; label: string; icon: string; secret?: boolean }[] = [
    { id: 'light', label: 'Világos (Sapientia)', icon: '🏛️' },
    { id: 'dark', label: 'Sötét', icon: '🌑' },
    { id: 'terminal', label: 'Faulty Terminal', icon: '💻', secret: true },
];

// CSS textures now, not WebGL scenes — hence no performance warning.
const BACKGROUND_EFFECTS: { id: BackgroundEffect; label: string; icon: string; secret?: boolean }[] = [
    { id: 'none', label: 'Nincs', icon: '—' },
    { id: 'grid', label: 'Rács', icon: '▦' },
    { id: 'dots', label: 'Pontok', icon: '⁘' },
    { id: 'scan', label: 'Scanlines', icon: '▤', secret: true },
];

interface SettingsProps {
    onNavigateToPrivacy?: () => void;
}

export default function Settings({ onNavigateToPrivacy }: SettingsProps = {}) {
    const { preferences, updatePreferences, selectedClass, setSelectedClass, setFirstLaunchComplete, logout, user } = useAppStore();
    const navigate = useNavigate();
    const [showThemeDropdown, setShowThemeDropdown] = useState(false);
    const [showEffectDropdown, setShowEffectDropdown] = useState(false);
    const [showClassSelector, setShowClassSelector] = useState(false);
    const backgroundEffect = useBackgroundEffect();
    const reducedMotion = prefersReducedMotion();

    const handleEffectSelect = (effect: BackgroundEffect) => {
        setBackgroundEffect(effect);
        setShowEffectDropdown(false);
    };

    // Class selection state
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [selectedFaculty, setSelectedFaculty] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string>('');

    useEffect(() => {
        fetchClasses().then(setClasses);
    }, []);

    const faculties = getUniqueFaculties(classes);
    const years = selectedFaculty ? getYearsForFaculty(classes, selectedFaculty) : [];
    const groups = selectedFaculty && selectedYear
        ? getGroupsForFacultyYear(classes, selectedFaculty, selectedYear)
        : [];

    const handleClassSelect = () => {
        if (selectedFaculty && selectedYear && selectedGroup) {
            const classData = findClass(classes, selectedFaculty, selectedYear, selectedGroup);
            if (classData) {
                setSelectedClass({
                    id: classData.id,
                    name: classData.name,
                    faculty: classData.faculty || '',
                    year: classData.year,
                    groupCode: classData.group_code || '',
                });
                setFirstLaunchComplete();
                setShowClassSelector(false);
            }
        }
    };


    // Easter Egg Logic
    const { isFaultyTerminalUnlocked, setFaultyTerminalUnlocked } = useAppStore();
    const [versionClickCount, setVersionClickCount] = useState(0);

    const handleVersionClick = async () => {
        if (isFaultyTerminalUnlocked) return;

        const newCount = versionClickCount + 1;
        setVersionClickCount(newCount);

        if (newCount === 10) {
            await setFaultyTerminalUnlocked(true);
            await updatePreferences({ colorTheme: 'terminal' });
            showToast('SYSTEM FAILURE IMMINENT... Theme unlocked.', 'success');
            setVersionClickCount(0);
        }
    };

    const getVersionText = () => {
        if (isFaultyTerminalUnlocked) return "1.0.0 (Patched)";
        if (versionClickCount > 5) {
            return `Self-destruct in ${10 - versionClickCount}...`;
        }
        return "1.0.0";
    };

    const handleLogout = () => {
        googleLogout();
        logout();
        navigate('/login');
    };

    const visibleThemes = COLOR_THEMES.filter(t => !t.secret || isFaultyTerminalUnlocked);
    const visibleEffects = BACKGROUND_EFFECTS.filter(t => !t.secret || isFaultyTerminalUnlocked);

    return (
        <div className="settings-container">
            {/* Color theme + background effect */}
            <div className="settings-section">
                <h2>Megjelenés</h2>
                <div className="settings-card panel">
                    {/* Color theme (synced token map) */}
                    <div
                        className="settings-row"
                        onClick={() => { setShowThemeDropdown(!showThemeDropdown); setShowEffectDropdown(false); }}
                    >
                        <div className="settings-label">
                            <span>🎨</span>
                            <span>Téma</span>
                        </div>
                        <div className="settings-value">
                            {COLOR_THEMES.find(t => t.id === preferences.colorTheme)?.label || 'Világos'}
                            <span className="settings-caret">{showThemeDropdown ? '▲' : '▼'}</span>
                        </div>
                    </div>
                    {showThemeDropdown && (
                        <div className="dropdown-content">
                            {visibleThemes.map((theme) => (
                                <div
                                    key={theme.id}
                                    className={`dropdown-option ${preferences.colorTheme === theme.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        updatePreferences({ colorTheme: theme.id });
                                        setShowThemeDropdown(false);
                                    }}
                                    data-secret={theme.secret || undefined}
                                >
                                    <span>{theme.icon} {theme.label}</span>
                                    {preferences.colorTheme === theme.id && <span>✓</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Ambient background (device-local, CSS only) */}
                    <div
                        className="settings-row settings-row--bordered"
                        style={{ opacity: reducedMotion ? 0.5 : 1 }}
                        onClick={() => { if (!reducedMotion) { setShowEffectDropdown(!showEffectDropdown); setShowThemeDropdown(false); } }}
                    >
                        <div className="settings-label">
                            <span>▦</span>
                            <div className="settings-label-stack">
                                <span>Háttérminta</span>
                                <span className="settings-label-hint">
                                    {reducedMotion
                                        ? 'Kikapcsolva (csökkentett mozgás beállítás aktív)'
                                        : 'Csak ezen az eszközön'}
                                </span>
                            </div>
                        </div>
                        <div className="settings-value">
                            {BACKGROUND_EFFECTS.find(t => t.id === backgroundEffect)?.label || 'Nincs'}
                            {!reducedMotion && <span className="settings-caret">{showEffectDropdown ? '▲' : '▼'}</span>}
                        </div>
                    </div>
                    {showEffectDropdown && !reducedMotion && (
                        <div className="dropdown-content">
                            {visibleEffects.map((effect) => (
                                <div
                                    key={effect.id}
                                    className={`dropdown-option ${backgroundEffect === effect.id ? 'selected' : ''}`}
                                    onClick={() => handleEffectSelect(effect.id)}
                                    data-secret={effect.secret || undefined}
                                >
                                    <span>{effect.icon} {effect.label}</span>
                                    {backgroundEffect === effect.id && <span>✓</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Timetable display options */}
            <div className="settings-section">
                <h2>Órarend</h2>
                <div className="settings-card panel">
                    <div
                        className="settings-row"
                        onClick={() => updatePreferences({ showTimeIndicator: !preferences.showTimeIndicator })}
                    >
                        <div className="settings-label">
                            <span>⏰</span>
                            <span>Idő jelző</span>
                        </div>
                        <div className={`toggle ${preferences.showTimeIndicator ? 'active' : ''}`}>
                            {preferences.showTimeIndicator ? '✓' : ''}
                        </div>
                    </div>

                    <div
                        className="settings-row"
                        onClick={() => updatePreferences({ invertWeekParity: !preferences.invertWeekParity })}
                    >
                        <div className="settings-label">
                            <span>🔄</span>
                            <div className="settings-label-stack">
                                <span>Páros/Páratlan hét megfordítása</span>
                                <span className="settings-label-hint">Eltérés a hivatalos akadémiai naptártól</span>
                            </div>
                        </div>
                        <div className={`toggle ${preferences.invertWeekParity ? 'active' : ''}`}>
                            {preferences.invertWeekParity ? '✓' : ''}
                        </div>
                    </div>
                </div>
            </div>

            {/* Management (Class & Data) */}
            <div className="settings-section">
                <h2>Kezelés</h2>
                <div className="settings-card panel">
                    {/* Selected Class */}
                    <div
                        className="settings-row clickable"
                        onClick={() => setShowClassSelector(!showClassSelector)}
                    >
                        <div className="settings-label">
                            <span>📚</span>
                            <span>Kiválasztott osztály</span>
                        </div>
                        <div className="settings-value">
                            {selectedClass?.name || 'Nincs kiválasztva'}
                            <span className="settings-caret">{showClassSelector ? '▲' : '▼'}</span>
                        </div>
                    </div>
                    {showClassSelector && (
                        <div className="dropdown-content dropdown-content--form">
                            {/* Faculty */}
                            <select
                                value={selectedFaculty}
                                onChange={(e) => {
                                    setSelectedFaculty(e.target.value);
                                    setSelectedYear(null);
                                    setSelectedGroup('');
                                }}
                                className="field-select"
                            >
                                <option value="">Válassz szakot...</option>
                                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>

                            {/* Year */}
                            {selectedFaculty && (
                                <select
                                    value={selectedYear || ''}
                                    onChange={(e) => {
                                        setSelectedYear(Number(e.target.value));
                                        setSelectedGroup('');
                                    }}
                                    className="field-select"
                                >
                                    <option value="">Válassz évet...</option>
                                    {years.map(y => <option key={y} value={y}>{y}. év</option>)}
                                </select>
                            )}

                            {/* Group */}
                            {selectedFaculty && selectedYear && (
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="field-select"
                                >
                                    <option value="">Válassz csoportot...</option>
                                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            )}

                            {/* Confirm button */}
                            {selectedFaculty && selectedYear && selectedGroup && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleClassSelect}
                                    style={{ width: '100%' }}
                                >
                                    Mentés
                                </button>
                            )}
                        </div>
                    )}
                    <div
                        className="settings-row clickable settings-row--bordered"
                        onClick={async () => {
                            const ok = await confirmDialog(
                                'Biztosan törölni szeretnél minden helyi adatot és beállítást?',
                                { confirmLabel: 'Törlés', danger: true },
                            );
                            if (!ok) return;
                            const { resetApp } = useAppStore.getState();
                            resetApp();
                        }}
                    >
                        <div className="settings-label destructive-text">
                            <span>🗑️</span>
                            <span>Alkalmazás alaphelyzetbe állítása</span>
                        </div>
                        <div className="settings-value">
                            <span>›</span>
                        </div>
                    </div>

                    {user?.email && (
                        <div className="settings-row settings-row--bordered settings-row--static">
                            <div className="settings-label">
                                <span>📧</span>
                                <div className="settings-label-stack">
                                    <span className="settings-label-hint">Bejelentkezve mint</span>
                                    <span className="mono">{user.email}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        className="settings-row clickable logout-row settings-row--bordered"
                        onClick={handleLogout}
                    >
                        <div className="settings-label destructive-text">
                            <span>🚪</span>
                            <span>Kijelentkezés</span>
                        </div>
                        <div className="settings-value destructive-text">
                            <span>›</span>
                        </div>
                    </div>
                </div>
            </div>


            {/* Version - Easter Egg Target */}
            <div className="settings-section">
                <h2>Névjegy</h2>
                <div className="settings-card panel">
                    <div className="settings-row settings-row--version" onClick={handleVersionClick}>
                        <div className="settings-label">
                            <span>ℹ️</span>
                            <span>Verzió</span>
                        </div>
                        <div className={`settings-value mono ${versionClickCount > 5 ? 'is-warning' : ''}`}>
                            {getVersionText()}
                        </div>
                    </div>

                    {/* Privacy Policy Link */}
                    {onNavigateToPrivacy && (
                        <div
                            className="settings-row clickable settings-row--bordered"
                            onClick={onNavigateToPrivacy}
                        >
                            <div className="settings-label">
                                <span>🛡️</span>
                                <span>Adatkezelés és Biztonság</span>
                            </div>
                            <div className="settings-value">
                                <span>›</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

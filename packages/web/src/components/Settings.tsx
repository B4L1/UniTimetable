// Settings component for web

import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { googleLogout } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass } from '@shared/index';
import type { ClassData, ColorTheme, BackgroundEffect } from '@shared/lib/types';
import {
    useBackgroundEffect, setBackgroundEffect,
    hasAcknowledgedPerfWarning, acknowledgePerfWarning,
    prefersReducedMotion,
} from '../utils/backgroundEffect';

const COLOR_THEMES: { id: ColorTheme; label: string; icon: string; secret?: boolean }[] = [
    { id: 'light', label: 'Világos (Sapientia)', icon: '🏛️' },
    { id: 'dark', label: 'Sötét', icon: '🌑' },
    { id: 'dark-glass', label: 'Sötét üveg', icon: '🧊' },
    { id: 'terminal', label: 'Faulty Terminal', icon: '💻', secret: true },
];

const BACKGROUND_EFFECTS: { id: BackgroundEffect; label: string; icon: string; secret?: boolean }[] = [
    { id: 'none', label: 'Nincs', icon: '✨' },
    { id: 'aurora', label: 'Aurora', icon: '🌌' },
    { id: 'pixel-blast', label: 'Pixel Blast', icon: '👾' },
    { id: 'iridescence', label: 'Iridescence', icon: '🌈' },
    { id: 'liquid-chrome', label: 'Liquid Chrome', icon: '💎' },
    { id: 'faulty-terminal', label: 'Faulty Terminal', icon: '📟', secret: true },
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
        if (effect !== 'none' && !hasAcknowledgedPerfWarning()) {
            const ok = confirm(
                'Az animált hátterek grafikus effekteket használnak, ami régebbi vagy gyengébb eszközökön lassíthatja az alkalmazást.\n\nBiztosan bekapcsolod?'
            );
            if (!ok) return;
            acknowledgePerfWarning();
        }
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
            alert("SYSTEM FAILURE IMMINENT... Theme unlocked.");
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
                <div className="settings-card glass-card">
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
                            <span style={{ marginLeft: 8 }}>{showThemeDropdown ? '▲' : '▼'}</span>
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
                                    style={theme.secret ? { color: '#0f0', fontFamily: 'monospace' } : undefined}
                                >
                                    <span>{theme.icon} {theme.label}</span>
                                    {preferences.colorTheme === theme.id && <span>✓</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Animated background effect (device-local, perf warning) */}
                    <div
                        className="settings-row"
                        style={{ borderTop: '1px solid var(--border)', opacity: reducedMotion ? 0.5 : 1 }}
                        onClick={() => { if (!reducedMotion) { setShowEffectDropdown(!showEffectDropdown); setShowThemeDropdown(false); } }}
                    >
                        <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span>🌠</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>Animált háttér</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '2px' }}>
                                    {reducedMotion
                                        ? 'Kikapcsolva (csökkentett mozgás beállítás aktív)'
                                        : 'Gyengébb eszközökön lassíthatja az alkalmazást · csak ezen az eszközön'}
                                </span>
                            </div>
                        </div>
                        <div className="settings-value">
                            {BACKGROUND_EFFECTS.find(t => t.id === backgroundEffect)?.label || 'Nincs'}
                            {!reducedMotion && <span style={{ marginLeft: 8 }}>{showEffectDropdown ? '▲' : '▼'}</span>}
                        </div>
                    </div>
                    {showEffectDropdown && !reducedMotion && (
                        <div className="dropdown-content">
                            {visibleEffects.map((effect) => (
                                <div
                                    key={effect.id}
                                    className={`dropdown-option ${backgroundEffect === effect.id ? 'selected' : ''}`}
                                    onClick={() => handleEffectSelect(effect.id)}
                                    style={effect.secret ? { color: '#0f0', fontFamily: 'monospace' } : undefined}
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
                <div className="settings-card glass-card">
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
                        <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span>🔄</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>Páros/Páratlan hét megfordítása</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '2px' }}>Eltérés a hivatalos akadémiai naptártól</span>
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
                <div className="settings-card glass-card">
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
                            <span style={{ marginLeft: 8 }}>{showClassSelector ? '▲' : '▼'}</span>
                        </div>
                    </div>
                    {showClassSelector && (
                        <div className="dropdown-content" style={{ padding: '16px' }}>
                            {/* Faculty */}
                            <select
                                value={selectedFaculty}
                                onChange={(e) => {
                                    setSelectedFaculty(e.target.value);
                                    setSelectedYear(null);
                                    setSelectedGroup('');
                                }}
                                style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
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
                                    style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
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
                                    style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
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
                        className="settings-row clickable"
                        style={{ borderTop: '1px solid var(--border)' }}
                        onClick={() => {
                            if (confirm('Biztosan törölni szeretnél minden helyi adatot és beállítást?')) {
                                const { resetApp } = useAppStore.getState();
                                resetApp();
                            }
                        }}
                    >
                        <div className="settings-label" style={{ color: 'var(--error)' }}>
                            <span>🗑️</span>
                            <span>Alkalmazás alaphelyzetbe állítása</span>
                        </div>
                        <div className="settings-value">
                            <span>›</span>
                        </div>
                    </div>

                    {user?.email && (
                        <div className="settings-row" style={{ borderTop: '1px solid var(--border)', cursor: 'default' }}>
                            <div className="settings-label">
                                <span>📧</span>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bejelentkezve mint</span>
                                    <span>{user.email}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        className="settings-row clickable logout-row"
                        style={{ borderTop: '1px solid var(--border)' }}
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
                <div className="settings-card glass-card">
                    <div className="settings-row" onClick={handleVersionClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div className="settings-label">
                            <span>ℹ️</span>
                            <span>Verzió</span>
                        </div>
                        <div className="settings-value" style={{ color: versionClickCount > 5 ? 'var(--accent)' : 'inherit', transition: 'color 0.2s' }}>
                            {getVersionText()}
                        </div>
                    </div>

                    {/* Privacy Policy Link */}
                    {onNavigateToPrivacy && (
                        <div
                            className="settings-row clickable"
                            style={{ borderTop: '1px solid var(--border)' }}
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

// Settings component for web

import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { googleLogout } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass, fetchTimetableEntriesByIds, fetchTimetableEntries } from '@shared/index';
import type { ClassData, BackgroundTheme } from '@shared/lib/types';

const BACKGROUND_THEMES: { id: BackgroundTheme; label: string; icon: string }[] = [
    { id: 'none', label: 'Sötét', icon: '🌑' },
    { id: 'aurora', label: 'Aurora', icon: '🌌' },
    { id: 'pixel-blast', label: 'Pixel Blast', icon: '👾' },
    { id: 'iridescence', label: 'Iridescence', icon: '🌈' },
    { id: 'liquid-chrome', label: 'Liquid Chrome', icon: '💎' },
    { id: 'sapientia', label: 'Sapientia', icon: '🏛️' },
    { id: 'faulty-terminal', label: 'Faulty Terminal', icon: '💻' },
];

interface SettingsProps {
    onNavigateToPrivacy?: () => void;
}

export default function Settings({ onNavigateToPrivacy }: SettingsProps = {}) {
    const { preferences, updatePreferences, selectedClass, setSelectedClass, setFirstLaunchComplete, logout, user } = useAppStore();
    const navigate = useNavigate();
    const [showBgDropdown, setShowBgDropdown] = useState(false);
    const [showClassSelector, setShowClassSelector] = useState(false);

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

    // --- Export / Import Backup ---
    const handleExport = async () => {
        const state = useAppStore.getState();
        let finalEntries = state.timetableEntries;

        try {
            if (state.userSelections && state.userSelections.length > 0) {
                // Fetch specific selections (planner mode)
                finalEntries = await fetchTimetableEntriesByIds(state.userSelections);
            } else if (finalEntries.length === 0 && state.selectedClass?.id) {
                // Fetch full cohort if cache was empty
                finalEntries = await fetchTimetableEntries(state.selectedClass.id);
            }
        } catch (err) {
            console.error('Failed to fully populate timetable entries before export:', err);
        }

        const exportData = {
            selectedClass: state.selectedClass,
            timetableEntries: finalEntries,
            userSelections: state.userSelections,
            preferences: state.preferences,
            importedSubjects: state.importedSubjects,
            isFaultyTerminalUnlocked: state.isFaultyTerminalUnlocked
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unitimetable-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);

                if (data && typeof data === 'object') {
                    const store = useAppStore.getState();

                    if (data.selectedClass !== undefined) await store.setSelectedClass(data.selectedClass);
                    if (data.timetableEntries !== undefined) store.setTimetableEntries(data.timetableEntries);
                    if (data.userSelections !== undefined) await store.setSelections(data.userSelections);
                    if (data.preferences !== undefined) await store.updatePreferences(data.preferences);
                    if (data.importedSubjects !== undefined) await store.setImportedSubjects(data.importedSubjects);
                    if (data.isFaultyTerminalUnlocked !== undefined) await store.setFaultyTerminalUnlocked(data.isFaultyTerminalUnlocked);

                    await store.initialize();
                    alert('Sikeres adatvisszaállítás!');
                } else {
                    alert('Érvénytelen fájlformátum.');
                }
            } catch (error) {
                console.error('Import failed:', error);
                alert('Hiba történt az importálás során. Hibás JSON formátum.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input so the same file can be selected again
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
            await updatePreferences({ backgroundTheme: 'faulty-terminal' });
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

    const regularThemes = BACKGROUND_THEMES.filter(t => t.id !== 'faulty-terminal');
    const secretThemes = BACKGROUND_THEMES.filter(t => t.id === 'faulty-terminal');

    return (
        <div className="settings-container">
            {/* Background Theme */}
            <div className="settings-section">
                <h2>Háttér</h2>
                <div className="settings-card glass-card">
                    <div
                        className="settings-row"
                        onClick={() => setShowBgDropdown(!showBgDropdown)}
                    >
                        <div className="settings-label">
                            <span>🎨</span>
                            <span>Háttér téma</span>
                        </div>
                        <div className="settings-value">
                            {BACKGROUND_THEMES.find(t => t.id === preferences.backgroundTheme)?.label || 'Nincs'}
                            <span style={{ marginLeft: 8 }}>{showBgDropdown ? '▲' : '▼'}</span>
                        </div>
                    </div>
                    {showBgDropdown && (
                        <div className="dropdown-content">
                            {regularThemes.map((theme) => (
                                <div
                                    key={theme.id}
                                    className={`dropdown-option ${preferences.backgroundTheme === theme.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        updatePreferences({ backgroundTheme: theme.id });
                                        setShowBgDropdown(false);
                                    }}
                                >
                                    <span>{theme.icon} {theme.label}</span>
                                    {preferences.backgroundTheme === theme.id && <span>✓</span>}
                                </div>
                            ))}

                            {isFaultyTerminalUnlocked && secretThemes.length > 0 && (
                                <>
                                    <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                                        Corrupted Data
                                    </div>
                                    {secretThemes.map((theme) => (
                                        <div
                                            key={theme.id}
                                            className={`dropdown-option ${preferences.backgroundTheme === theme.id ? 'selected' : ''}`}
                                            onClick={() => {
                                                updatePreferences({ backgroundTheme: theme.id });
                                                setShowBgDropdown(false);
                                            }}
                                            style={{ color: '#0f0', fontFamily: 'monospace' }}
                                        >
                                            <span>{theme.icon} {theme.label}</span>
                                            {preferences.backgroundTheme === theme.id && <span>✓</span>}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Appearance */}
            <div className="settings-section">
                <h2>Megjelenés</h2>
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
                                style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
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
                                    style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
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
                                    style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
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

            {/* Backup & Restore */}
            <div className="settings-section">
                <h2>Adatmentés</h2>
                <div className="settings-card glass-card">
                    <div
                        className="settings-row clickable"
                        onClick={handleExport}
                    >
                        <div className="settings-label">
                            <span>💾</span>
                            <span>Mentés exportálása fájlba</span>
                        </div>
                        <div className="settings-value">
                            <span>›</span>
                        </div>
                    </div>

                    <div
                        className="settings-row clickable"
                        style={{ borderTop: '1px solid var(--border)' }}
                        onClick={() => document.getElementById('import-file-upload')?.click()}
                    >
                        <div className="settings-label">
                            <span>📂</span>
                            <span>Mentés importálása fájlból</span>
                        </div>
                        <div className="settings-value">
                            <span>›</span>
                        </div>
                        <input
                            id="import-file-upload"
                            type="file"
                            accept=".json"
                            style={{ display: 'none' }}
                            onChange={handleImport}
                        />
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

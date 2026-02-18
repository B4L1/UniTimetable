// Settings component for web

import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass } from '@shared/index';
import type { ClassData, BackgroundTheme } from '@shared/lib/types';

const BACKGROUND_THEMES: { id: BackgroundTheme; label: string; icon: string }[] = [
    { id: 'none', label: 'Sötét', icon: '🌑' },
    { id: 'silk', label: 'Silk', icon: '🧵' },
    { id: 'aurora', label: 'Aurora', icon: '🌌' },

    { id: 'pixel-blast', label: 'Pixel Blast', icon: '👾' },
    { id: 'iridescence', label: 'Iridescence', icon: '🌈' },
    { id: 'liquid-chrome', label: 'Liquid Chrome', icon: '💎' },
    { id: 'sapientia', label: 'Sapientia', icon: '🏛️' },
    { id: 'faulty-terminal', label: 'Faulty Terminal', icon: '💻' },
];

export default function Settings() {
    const { preferences, updatePreferences, selectedClass, setSelectedClass, setFirstLaunchComplete } = useAppStore();
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

    // --- Import Subjects Logic ---
    const { userSelections, timetableEntries, setSelections, importedSubjects, addImportedSubject, removeImportedSubject } = useAppStore();
    const [showImportSelector, setShowImportSelector] = useState(false);

    // New Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ name: string, count: number }[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [isImportLoading, setIsImportLoading] = useState(false);

    // Perform Search
    const handleSearch = async () => {
        if (!searchQuery || searchQuery.trim().length < 2) return;
        setIsImportLoading(true);
        try {
            const { searchTimetableEntriesBySubject } = await import('@shared/index');
            const results = await searchTimetableEntriesBySubject(searchQuery);

            // Group by subject name
            const uniqueSubjects = new Map<string, number>();
            results.forEach(entry => {
                const count = uniqueSubjects.get(entry.subject_name) || 0;
                uniqueSubjects.set(entry.subject_name, count + 1);
            });

            setSearchResults(Array.from(uniqueSubjects.entries()).map(([name, count]) => ({ name, count })));
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsImportLoading(false);
        }
    };

    // Confirm import
    const handleImportConfirm = async () => {
        if (selectedSubjects.length === 0) return;

        setIsImportLoading(true);
        try {
            for (const subject of selectedSubjects) {
                await addImportedSubject(subject);
            }

            alert(`Sikeresen importálva: ${selectedSubjects.join(', ')}`);
            setShowImportSelector(false);
            setSearchQuery('');
            setSearchResults([]);
            setSelectedSubjects([]);
        } catch (error) {
            console.error('Import failed:', error);
            alert('Hiba történt az importálás közben.');
        } finally {
            setIsImportLoading(false);
        }
    };

    // Remove imported subject
    const handleRemoveSubject = async (subject: string) => {
        if (confirm(`Biztosan törlöd a "${subject}" tárgyat az importáltak közül?`)) {
            await removeImportedSubject(subject);
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
                        <div className="settings-label">
                            <span>🔄</span>
                            <span>Páros/Páratlan hét cseréje</span>
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
                                style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: '#1a1a24', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
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
                                    style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: '#1a1a24', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
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
                                    style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: '#1a1a24', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
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

                    {/* Import / Search Subjects */}
                    <div
                        className="settings-row clickable"
                        style={{ borderTop: '1px solid var(--border)' }}
                        onClick={() => setShowImportSelector(!showImportSelector)}
                    >
                        <div className="settings-label">
                            <span>➕</span>
                            <span>Tárgy keresése és felvétele</span>
                        </div>
                        <div className="settings-value">
                            <span>{showImportSelector ? '▲' : '▼'}</span>
                        </div>
                    </div>

                    {showImportSelector && (
                        <div className="dropdown-content" style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                Keress tárgyakat név szerint. A kiválasztott tárgyak összes csoportja megjelenik majd az órarend tervezőben.
                            </p>

                            {/* Currently Imported */}
                            {importedSubjects.length > 0 && (
                                <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Már felvett tárgyak:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {importedSubjects.map(sub => (
                                            <span key={sub} style={{
                                                fontSize: '0.8rem',
                                                background: 'var(--accent)',
                                                color: 'var(--bg-primary)',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {sub}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveSubject(sub); }}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                                                >❌</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Search Input */}
                            <div className="form-group" style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Tárgy neve..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        background: '#1a1a24',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSearch}
                                    disabled={isImportLoading || searchQuery.length < 2}
                                >
                                    {isImportLoading ? '...' : 'Keresés'}
                                </button>
                            </div>

                            {/* Results List */}
                            {searchResults.length > 0 && (
                                <div style={{
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    marginBottom: '12px',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '8px',
                                    padding: '8px'
                                }}>
                                    {searchResults.map(entry => {
                                        const isAlreadyImported = importedSubjects.includes(entry.name);
                                        return (
                                            <label key={entry.name} style={{
                                                display: 'flex',
                                                alignItems: 'center', // Center vertically
                                                padding: '12px 8px', // More padding
                                                cursor: isAlreadyImported ? 'default' : 'pointer',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                gap: '10px',
                                                opacity: isAlreadyImported ? 0.5 : 1
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    disabled={isAlreadyImported}
                                                    checked={selectedSubjects.includes(entry.name) || isAlreadyImported}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedSubjects([...selectedSubjects, entry.name]);
                                                        } else {
                                                            setSelectedSubjects(selectedSubjects.filter(name => name !== entry.name));
                                                        }
                                                    }}
                                                    style={{ width: '18px', height: '18px', flexShrink: 0 }}
                                                />
                                                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                                    <div style={{ fontWeight: 'bold' }}>{entry.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        {entry.count} találat • {isAlreadyImported ? 'Már felvéve' : 'Elérhető'}
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}

                            {searchResults.length === 0 && searchQuery && !isImportLoading && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '10px 0' }}>
                                    Nincs találat. Próbálj másik kulcsszót.
                                </p>
                            )}

                            {/* Confirm Button */}
                            {selectedSubjects.length > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleImportConfirm}
                                    disabled={isImportLoading}
                                    style={{ width: '100%' }}
                                >
                                    {isImportLoading ? 'Mentés...' : `${selectedSubjects.length} tárgy hozzáadása`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Reset App */}
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
                </div>
            </div>
        </div>
    );
}

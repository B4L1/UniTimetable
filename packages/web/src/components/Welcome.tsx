// Welcome screen for initial class selection

import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass } from '@shared/index';
import type { ClassData, BackgroundTheme } from '@shared/lib/types';
import BackgroundSelector from './backgrounds/BackgroundSelector';

const LAST_DARK_THEME_KEY = 'uni-last-dark-theme';
const DARK_THEMES: BackgroundTheme[] = ['none', 'aurora', 'pixel-blast', 'silk', 'beams', 'dither', 'iridescence', 'liquid-chrome', 'faulty-terminal'];

function withViewTransition(update: () => void) {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        (document as any).startViewTransition(update);
    } else {
        update();
    }
}

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

export default function Welcome() {
    const { setSelectedClass, setFirstLaunchComplete, preferences, updatePreferences } = useAppStore();
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [selectedFaculty, setSelectedFaculty] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchClasses().then(data => {
            setClasses(data);
            setIsLoading(false);
        });
    }, []);

    const faculties = getUniqueFaculties(classes);
    const years = selectedFaculty ? getYearsForFaculty(classes, selectedFaculty) : [];
    const groups = selectedFaculty && selectedYear
        ? getGroupsForFacultyYear(classes, selectedFaculty, selectedYear)
        : [];

    const handleConfirm = () => {
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
            }
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data && typeof data === 'object') {
                    const store = useAppStore.getState();
                    if (data.selectedClass !== undefined) await store.setSelectedClass(data.selectedClass);
                    if (data.timetableEntries !== undefined) store.setTimetableEntries(data.timetableEntries);
                    if (data.userSelections !== undefined) await store.setSelections(data.userSelections);
                    if (data.preferences !== undefined) await store.updatePreferences(data.preferences);
                    if (data.importedSubjects !== undefined) await store.setImportedSubjects(data.importedSubjects);
                    if (data.isFaultyTerminalUnlocked !== undefined) await store.setFaultyTerminalUnlocked(data.isFaultyTerminalUnlocked);

                    await store.setFirstLaunchComplete();
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
        e.target.value = '';
    };

    const toggleTheme = () => {
        const isLight = preferences.backgroundTheme === 'sapientia';
        if (isLight) {
            const stored = localStorage.getItem(LAST_DARK_THEME_KEY) as BackgroundTheme | null;
            const target = (stored && DARK_THEMES.includes(stored)) ? stored : 'none';
            withViewTransition(() => updatePreferences({ backgroundTheme: target }));
        } else {
            localStorage.setItem(LAST_DARK_THEME_KEY, preferences.backgroundTheme);
            withViewTransition(() => updatePreferences({ backgroundTheme: 'sapientia' }));
        }
    };

    return (
        <div className="welcome-container" style={{ position: 'relative' }}>
            <BackgroundSelector theme={preferences.backgroundTheme} />

            <button
                onClick={toggleTheme}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    zIndex: 10,
                    background: 'rgba(26, 26, 36, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease'
                }}
            >
                {preferences.backgroundTheme === 'sapientia' ? <SunIcon /> : <MoonIcon />}
            </button>

            <div className="glass-card welcome-card">
                <h1 className="welcome-title">
                    👋 Üdvözöllek!
                </h1>
                <p>Kérlek válaszd ki az osztályodat a folytatáshoz.</p>

                {isLoading ? (
                    <div className="spinner-container">
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div className="selection-form">
                        {classes.length === 0 ? (
                            <div className="empty-state-message" style={{ textAlign: 'center', padding: '20px' }}>
                                <p>⚠️ Nem sikerült betölteni az osztályokat, vagy még üres az adatbázis.</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setIsLoading(true);
                                        fetchClasses().then(data => {
                                            setClasses(data);
                                            setIsLoading(false);
                                        });
                                    }}
                                    style={{ marginTop: '10px' }}
                                >
                                    🔄 Újrapróbálkozás
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label>Szak</label>
                                    <select
                                        value={selectedFaculty}
                                        onChange={(e) => {
                                            setSelectedFaculty(e.target.value);
                                            setSelectedYear(null);
                                            setSelectedGroup('');
                                        }}
                                    >
                                        <option value="">Válassz szakot...</option>
                                        {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>

                                {selectedFaculty && (
                                    <div className="form-group">
                                        <label>Évfolyam</label>
                                        <select
                                            value={selectedYear || ''}
                                            onChange={(e) => {
                                                setSelectedYear(Number(e.target.value));
                                                setSelectedGroup('');
                                            }}
                                        >
                                            <option value="">Válassz évet...</option>
                                            {years.map(y => <option key={y} value={y}>{y}. év</option>)}
                                        </select>
                                    </div>
                                )}

                                {selectedFaculty && selectedYear && (
                                    <div className="form-group">
                                        <label>Csoport</label>
                                        <select
                                            value={selectedGroup}
                                            onChange={(e) => setSelectedGroup(e.target.value)}
                                        >
                                            <option value="">Válassz csoportot...</option>
                                            {groups.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary start-btn"
                                    disabled={!selectedFaculty || !selectedYear || !selectedGroup}
                                    onClick={handleConfirm}
                                >
                                    Indítás 🚀
                                </button>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    margin: '20px 0',
                                    width: '100%',
                                    opacity: preferences.backgroundTheme === 'sapientia' ? 1 : 0.6
                                }}>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                                    <span style={{ padding: '0 10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>VAGY</span>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                                </div>

                                <button
                                    className="btn clickable welcome-import-btn"
                                    onClick={() => document.getElementById('welcome-import-file')?.click()}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <span>📂</span> Órarend importálása fájlból
                                </button>
                                <input
                                    id="welcome-import-file"
                                    type="file"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={handleImport}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}

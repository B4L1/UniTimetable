// Welcome screen for initial class selection

import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass } from '@shared/index';
import type { ClassData } from '@shared/lib/types';
import BackgroundSelector from './backgrounds/BackgroundSelector';

export default function Welcome() {
    const { setSelectedClass, setFirstLaunchComplete } = useAppStore();
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

    return (
        <div className="welcome-container">
            <BackgroundSelector theme="aurora" />

            <div className="glass-card welcome-card">
                <h1>👋 Üdvözöllek!</h1>
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
                            </>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}

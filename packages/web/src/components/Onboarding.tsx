import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass, fetchTeachers } from '@shared/index';
import type { ClassData, Teacher } from '@shared/lib/types';
import './Onboarding.css';

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { user, setUser, setSelectedClass, setSelectedTeacher } = useAppStore();
    const [selection, setSelection] = useState<string>('');
    
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const teacherOptions = teachers.map(t => ({ value: t.id, label: t.name }));

    // Student selection state
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [selectedFaculty, setSelectedFaculty] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string>('');

    useEffect(() => {
        fetchClasses().then(setClasses);
        fetchTeachers().then(setTeachers);
    }, []);

    const faculties = getUniqueFaculties(classes);
    const years = selectedFaculty ? getYearsForFaculty(classes, selectedFaculty) : [];
    const groups = selectedFaculty && selectedYear
        ? getGroupsForFacultyYear(classes, selectedFaculty, selectedYear)
        : [];

    if (!user) {
        navigate('/login');
        return null;
    }

    const isStudent = user.role === 'student';

    const handleSave = async () => {
        let selectionId = '';
        
        if (isStudent) {
            const classData = findClass(classes, selectedFaculty, selectedYear!, selectedGroup);
            if (classData) {
                selectionId = classData.id;
                await setSelectedClass({
                    id: classData.id,
                    name: classData.name,
                    faculty: classData.faculty || '',
                    year: classData.year,
                    groupCode: classData.group_code || '',
                });
            }
        } else {
            const teacher = teachers.find(t => t.id === selection);
            if (teacher) {
                selectionId = teacher.id;
                await setSelectedTeacher({ id: teacher.id, name: teacher.name });
            }
        }

        if (!selectionId) return;

        const updatedUser = {
            ...user,
            selectionId
        };

        await setUser(updatedUser);

        navigate('/');
    };

    const customStyles = {
        control: (base: any) => ({
            ...base,
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
            borderRadius: '8px',
            '&:hover': {
                borderColor: 'var(--accent)'
            }
        }),
        menu: (base: any) => ({
            ...base,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)'
        }),
        option: (base: any, state: any) => ({
            ...base,
            background: state.isSelected ? 'var(--accent)' : state.isFocused ? 'var(--bg-alt)' : 'transparent',
            color: state.isSelected ? '#fff' : 'var(--text-primary)',
            '&:active': {
                background: 'var(--accent)'
            }
        }),
        singleValue: (base: any) => ({
            ...base,
            color: 'var(--text-primary)'
        }),
        input: (base: any) => ({
            ...base,
            color: 'var(--text-primary)'
        })
    };

    return (
        <div className="onboarding-container">
            <div className="onboarding-card glass-card">
                <h1>Üdvözlünk!</h1>
                <p className="onboarding-intro">
                    Kérjük, válaszd ki a csoportodat vagy a nevedet az alábbiak közül. Ezt csak egyszer kell megtenned – elmentjük a választásodat a fiókodhoz, így az órarended automatikusan betöltődik bármely eszközön, amelyen bejelentkezel.
                </p>

                {isStudent ? (
                    <div className="onboarding-form">
                        {/* Faculty */}
                        <div className="form-group">
                            <label>Szak</label>
                            <select 
                                value={selectedFaculty} 
                                onChange={(e) => {
                                    setSelectedFaculty(e.target.value);
                                    setSelectedYear(null);
                                    setSelectedGroup('');
                                }}
                                className="onboarding-select"
                            >
                                <option value="">Válassz szakot...</option>
                                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>

                        {/* Year */}
                        {selectedFaculty && (
                            <div className="form-group">
                                <label>Évfolyam</label>
                                <select 
                                    value={selectedYear || ''} 
                                    onChange={(e) => {
                                        setSelectedYear(Number(e.target.value));
                                        setSelectedGroup('');
                                    }}
                                    className="onboarding-select"
                                >
                                    <option value="">Válassz évfolyamot...</option>
                                    {years.map(y => <option key={y} value={y}>{y}. évfolyam</option>)}
                                </select>
                            </div>
                        )}

                        {/* Group */}
                        {selectedFaculty && selectedYear && (
                            <div className="form-group">
                                <label>Csoport</label>
                                <select 
                                    value={selectedGroup} 
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="onboarding-select"
                                >
                                    <option value="">Válassz csoportot...</option>
                                    {groups.map(g => <option key={g} value={g}>{g} csoport</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="onboarding-form">
                        <div className="form-group">
                            <label>Keresd meg a nevedet</label>
                            <Select
                                options={teacherOptions}
                                onChange={(opt: any) => setSelection(opt?.value || '')}
                                placeholder="Kezdd el gépelni a neved..."
                                isSearchable
                                styles={customStyles}
                                noOptionsMessage={() => "Nincs találat"}
                            />
                        </div>
                    </div>
                )}

                <button 
                    className="save-btn" 
                    onClick={handleSave}
                    disabled={isStudent ? (!selectedFaculty || !selectedYear || !selectedGroup) : !selection}
                >
                    Mentés és folytatás
                </button>
            </div>
        </div>
    );
};

export default Onboarding;

import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { fetchClasses, getUniqueFaculties, getYearsForFaculty, getGroupsForFacultyYear, findClass, fetchTeachers, fetchUserPreferences, fetchClassById } from '@shared/index';
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
    const [isAutoLoading, setIsAutoLoading] = useState(true);

    useEffect(() => {
        let isCancelled = false;

        const loadData = async () => {
            setIsAutoLoading(true);

            const [classesData, teachersData] = await Promise.all([
                fetchClasses(),
                fetchTeachers(),
            ]);

            if (isCancelled) return;

            setClasses(classesData);
            setTeachers(teachersData);

            // Try to auto-load saved class from server
            if (user?.email && user.role === 'student') {
                const prefs = await fetchUserPreferences(user.email);
                if (isCancelled) return;

                const selectionId = prefs?.selected_class_id || user.selectionId;
                if (selectionId) {
                    let savedClass = classesData.find(c => c.id === selectionId) || null;

                    if (!savedClass) {
                        savedClass = await fetchClassById(selectionId);
                        if (savedClass) {
                            setClasses((current) => {
                                const exists = current.some(c => c.id === savedClass!.id);
                                return exists ? current : [...current, savedClass!];
                            });
                        }
                    }

                    if (savedClass) {
                        await setSelectedClass({
                            id: savedClass.id,
                            name: savedClass.name,
                            faculty: savedClass.faculty || '',
                            year: savedClass.year,
                            groupCode: savedClass.group_code || '',
                        });

                        if (user.selectionId !== selectionId) {
                            await setUser({ ...user, selectionId });
                        }

                        navigate('/');
                        return;
                    }
                }
            }

            setIsAutoLoading(false);
        };

        loadData();

        return () => {
            isCancelled = true;
        };
    }, [navigate, setSelectedClass, setUser, user?.email]);

    const faculties = getUniqueFaculties(classes);
    const years = selectedFaculty ? getYearsForFaculty(classes, selectedFaculty) : [];
    const groups = selectedFaculty && selectedYear
        ? getGroupsForFacultyYear(classes, selectedFaculty, selectedYear)
        : [];

    if (!user) {
        // Declarative redirect — calling navigate() during render is a React anti-pattern
        return <Navigate to="/login" replace />;
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
            borderRadius: 'var(--radius-sm)',
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

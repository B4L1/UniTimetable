import React, { useState } from 'react';
import { useAppStore } from '../stores/appStore';

interface ImportSubjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ImportSubjectModal({ isOpen, onClose }: ImportSubjectModalProps) {
    const { importedSubjects, addImportedSubject, removeImportedSubject, removedSubjects, addRemovedSubject, removeRemovedSubject, timetableEntries } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ name: string, count: number }[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [isImportLoading, setIsImportLoading] = useState(false);
    
    // Accordion states
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);

    if (!isOpen) return null;

    // Derived full list of currently active subjects
    const activeSubjects = Array.from(new Set([
        ...timetableEntries.map(e => e.subject_name),
        ...importedSubjects
    ])).filter(sub => !removedSubjects.includes(sub)).sort();

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
            setSearchQuery('');
            setSearchResults([]);
            setSelectedSubjects([]);
            // Don't close modal completely, maybe the user wants to remove things
            setIsImportOpen(false); 
        } catch (error) {
            console.error('Import failed:', error);
            alert('Hiba történt az importálás közben.');
        } finally {
            setIsImportLoading(false);
        }
    };

    // Remove imported subject
    const handleRemoveSubject = async (subject: string) => {
        if (confirm(`Biztosan törlöd a "${subject}" tárgyat az extra importáltak közül (így teljesen törlődik a memóriából)?`)) {
            await removeImportedSubject(subject);
            // also remove from removedSubjects if there
            if (removedSubjects.includes(subject)) {
                await removeRemovedSubject(subject);
            }
        }
    };

    // Modal background overlay style
    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
    };

    // Modal content style
    const contentStyle: React.CSSProperties = {
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden'
    };

    const headerStyle: React.CSSProperties = {
        padding: '20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)'
    };

    const bodyStyle: React.CSSProperties = {
        padding: '20px',
        overflowY: 'auto',
        flex: 1
    };

    const closeButtonStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: 'var(--text-secondary)',
        fontSize: '24px',
        cursor: 'pointer',
        padding: '0 8px'
    };

    const accordionContentStyle = (isOpen: boolean): React.CSSProperties => ({
        maxHeight: isOpen ? '1000px' : '0px',
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'all 0.3s var(--ease)',
        padding: isOpen ? '0 16px 16px 16px' : '0 16px'
    });

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Tárgy kezelés</h2>
                    <button style={closeButtonStyle} onClick={onClose}>&times;</button>
                </div>

                <div style={bodyStyle}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Itt kezelheted a tervezőben megjelenő tárgyaidat.
                    </p>

                    {/* IMPORT SECTION */}
                    <div style={{ marginBottom: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setIsImportOpen(!isImportOpen)}
                            style={{
                                width: '100%', padding: '16px', background: 'transparent', border: 'none',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Új tárgyak importálása
                            </span>
                            <span style={{ 
                                transform: isImportOpen ? 'rotate(90deg)' : 'rotate(0deg)', 
                                transition: 'transform 0.3s var(--ease)'
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </span>
                        </button>

                        <div style={accordionContentStyle(isImportOpen)}>
                            {/* Search Input */}
                            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Tárgy neve (pl. Matek)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                                        background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)',
                                        border: '1px solid var(--border)', outline: 'none', fontSize: '0.95rem'
                                    }}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSearch}
                                    disabled={isImportLoading || searchQuery.trim().length < 2}
                                    style={{ padding: '0 16px', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}
                                >
                                    {isImportLoading ? '...' : 'Keresés'}
                                </button>
                            </div>

                            {/* Results List */}
                            {searchResults.length > 0 && (
                                <div style={{
                                    maxHeight: '250px', overflowY: 'auto', marginBottom: '16px',
                                    background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', padding: '8px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    {searchResults.map(entry => {
                                        const isAlreadyImported = importedSubjects.includes(entry.name);
                                        return (
                                            <label key={entry.name} style={{
                                                display: 'flex', alignItems: 'center', padding: '12px',
                                                cursor: isAlreadyImported ? 'default' : 'pointer',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)', gap: '12px',
                                                opacity: isAlreadyImported ? 0.5 : 1, transition: 'background var(--transition)', borderRadius: 'var(--radius-sm)'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    disabled={isAlreadyImported}
                                                    checked={selectedSubjects.includes(entry.name) || isAlreadyImported}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedSubjects([...selectedSubjects, entry.name]);
                                                        else setSelectedSubjects(selectedSubjects.filter(name => name !== entry.name));
                                                    }}
                                                    style={{ width: '18px', height: '18px', flexShrink: 0, cursor: isAlreadyImported ? 'default' : 'pointer', accentColor: 'var(--accent)' }}
                                                />
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>{entry.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {entry.count} találat • {isAlreadyImported ? 'Már felvéve' : 'Elérhető'}
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}

                            {searchResults.length === 0 && searchQuery && !isImportLoading && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '20px 0' }}>
                                    Nincs találat. Próbálj másik kulcsszót.
                                </p>
                            )}

                            {selectedSubjects.length > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleImportConfirm}
                                    disabled={isImportLoading}
                                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)' }}
                                >
                                    {isImportLoading ? 'Mentés...' : `${selectedSubjects.length} tárgy felvétele`}
                                </button>
                            )}

                            {/* Currently Imported */}
                            {importedSubjects.length > 0 && (
                                <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Saját importált tárgyak:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {importedSubjects.map(sub => (
                                            <span key={`imported-${sub}`} style={{
                                                fontSize: '0.8rem', background: 'var(--accent)', color: 'white',
                                                padding: '4px 10px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500
                                            }}>
                                                {sub}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveSubject(sub); }}
                                                    style={{ border: 'none', background: 'rgba(0,0,0,0.15)', color: 'white', cursor: 'pointer', padding: '2px', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
                                                >✕</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* REMOVE SECTION */}
                    <div style={{ marginBottom: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <button
                            onClick={() => setIsRemoveOpen(!isRemoveOpen)}
                            style={{
                                width: '100%', padding: '16px', background: 'transparent', border: 'none',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                Tárgyak eltávolítása
                            </span>
                            <span style={{ 
                                transform: isRemoveOpen ? 'rotate(90deg)' : 'rotate(0deg)', 
                                transition: 'transform 0.3s var(--ease)'
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </span>
                        </button>

                        <div style={accordionContentStyle(isRemoveOpen)}>
                            {activeSubjects.length > 0 ? (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Aktív tárgyak eltüntetése a tervezőből:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {activeSubjects.map(sub => (
                                            <span key={`active-${sub}`} style={{
                                                fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
                                                padding: '6px 12px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.1)'
                                            }}>
                                                {sub}
                                                <button
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        addRemovedSubject(sub);
                                                    }}
                                                    title="Eltávolítás"
                                                    style={{ border: 'none', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    Nincs elérhető aktív tárgy.
                                </div>
                            )}

                            {removedSubjects.length > 0 && (
                                <div style={{ marginTop: '16px', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Eltávolított (elrejtett) tárgyak:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {removedSubjects.map(sub => (
                                            <span key={`removed-${sub}`} style={{
                                                fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--error, #ef4444)',
                                                padding: '6px 12px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500
                                            }}>
                                                {sub}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeRemovedSubject(sub); }}
                                                    title="Visszaállítás"
                                                    style={{ border: 'none', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error, #ef4444)', cursor: 'pointer', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { showToast } from '../stores/toastStore';
import { confirmDialog } from '../stores/confirmStore';
import './ImportSubjectModal.css';

interface ImportSubjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChevronIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

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

            showToast(`Sikeresen importálva: ${selectedSubjects.join(', ')}`, 'success');
            setSearchQuery('');
            setSearchResults([]);
            setSelectedSubjects([]);
            // Don't close modal completely, maybe the user wants to remove things
            setIsImportOpen(false);
        } catch (error) {
            console.error('Import failed:', error);
            showToast('Hiba történt az importálás közben.', 'error');
        } finally {
            setIsImportLoading(false);
        }
    };

    // Remove imported subject
    const handleRemoveSubject = async (subject: string) => {
        const ok = await confirmDialog(
            `Biztosan törlöd a "${subject}" tárgyat az extra importáltak közül (így teljesen törlődik a memóriából)?`,
            { confirmLabel: 'Törlés', danger: true },
        );
        if (!ok) return;
        await removeImportedSubject(subject);
        // also remove from removedSubjects if there
        if (removedSubjects.includes(subject)) {
            await removeRemovedSubject(subject);
        }
    };

    return (
        <div className="modal-scrim" onClick={onClose}>
            <div className="modal-panel" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Tárgy kezelés</h2>
                    <button className="modal-close" onClick={onClose} aria-label="Bezárás">&times;</button>
                </div>

                <div className="modal-body">
                    <p className="modal-intro">Itt kezelheted a tervezőben megjelenő tárgyaidat.</p>

                    {/* IMPORT SECTION */}
                    <div className={`accordion ${isImportOpen ? 'is-open' : ''}`}>
                        <button className="accordion-trigger" onClick={() => setIsImportOpen(!isImportOpen)}>
                            <span className="accordion-trigger-label">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Új tárgyak importálása
                            </span>
                            <span className="accordion-chevron"><ChevronIcon /></span>
                        </button>

                        <div className="accordion-content">
                            {/* Search Input */}
                            <div className="import-search">
                                <input
                                    type="text"
                                    placeholder="Tárgy neve (pl. Matek)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSearch}
                                    disabled={isImportLoading || searchQuery.trim().length < 2}
                                >
                                    {isImportLoading ? '...' : 'Keresés'}
                                </button>
                            </div>

                            {/* Results List */}
                            {searchResults.length > 0 && (
                                <div className="import-results">
                                    {searchResults.map(entry => {
                                        const isAlreadyImported = importedSubjects.includes(entry.name);
                                        return (
                                            <label key={entry.name} className={`import-result ${isAlreadyImported ? 'is-taken' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    disabled={isAlreadyImported}
                                                    checked={selectedSubjects.includes(entry.name) || isAlreadyImported}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedSubjects([...selectedSubjects, entry.name]);
                                                        else setSelectedSubjects(selectedSubjects.filter(name => name !== entry.name));
                                                    }}
                                                />
                                                <div>
                                                    <div className="import-result-name">{entry.name}</div>
                                                    <div className="import-result-meta">
                                                        {entry.count} találat • {isAlreadyImported ? 'Már felvéve' : 'Elérhető'}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {searchResults.length === 0 && searchQuery && !isImportLoading && (
                                <p className="import-empty">Nincs találat. Próbálj másik kulcsszót.</p>
                            )}

                            {selectedSubjects.length > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleImportConfirm}
                                    disabled={isImportLoading}
                                    style={{ width: '100%' }}
                                >
                                    {isImportLoading ? 'Mentés...' : `${selectedSubjects.length} tárgy felvétele`}
                                </button>
                            )}

                            {/* Currently Imported */}
                            {importedSubjects.length > 0 && (
                                <div className="tag-group">
                                    <div className="tag-group-label">Saját importált tárgyak</div>
                                    <div className="tag-list">
                                        {importedSubjects.map(sub => (
                                            <span key={`imported-${sub}`} className="tag tag--accent">
                                                {sub}
                                                <button
                                                    className="tag-remove"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveSubject(sub); }}
                                                    aria-label={`${sub} törlése`}
                                                >✕</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* REMOVE SECTION */}
                    <div className={`accordion ${isRemoveOpen ? 'is-open' : ''}`}>
                        <button className="accordion-trigger" onClick={() => setIsRemoveOpen(!isRemoveOpen)}>
                            <span className="accordion-trigger-label">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                Tárgyak eltávolítása
                            </span>
                            <span className="accordion-chevron"><ChevronIcon /></span>
                        </button>

                        <div className="accordion-content">
                            {activeSubjects.length > 0 ? (
                                <div className="tag-group">
                                    <div className="tag-group-label">Aktív tárgyak eltüntetése a tervezőből</div>
                                    <div className="tag-list">
                                        {activeSubjects.map(sub => (
                                            <span key={`active-${sub}`} className="tag">
                                                {sub}
                                                <button
                                                    className="tag-remove"
                                                    onClick={(e) => { e.stopPropagation(); addRemovedSubject(sub); }}
                                                    title="Eltávolítás"
                                                    aria-label={`${sub} eltávolítása`}
                                                >
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="import-empty">Nincs elérhető aktív tárgy.</p>
                            )}

                            {removedSubjects.length > 0 && (
                                <div className="tag-group tag-group--danger">
                                    <div className="tag-group-label">Eltávolított (elrejtett) tárgyak</div>
                                    <div className="tag-list">
                                        {removedSubjects.map(sub => (
                                            <span key={`removed-${sub}`} className="tag tag--danger">
                                                {sub}
                                                <button
                                                    className="tag-remove"
                                                    onClick={(e) => { e.stopPropagation(); removeRemovedSubject(sub); }}
                                                    title="Visszaállítás"
                                                    aria-label={`${sub} visszaállítása`}
                                                >
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>
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

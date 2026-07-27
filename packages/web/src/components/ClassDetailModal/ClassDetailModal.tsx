// Class detail window — opened by tapping a timetable card. On desktop the
// card morphs into the window via a shared layoutId (zoom out), and morphs
// back on close (button, backdrop click, or Esc).

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getSubjectColor } from '@shared/index';
import type { AvailableClassEntry } from '@shared/lib/api';
import './ClassDetailModal.css';

const DAY_NAMES = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

const WEEK_LABEL: Record<string, string> = {
    all: 'Minden héten',
    odd: 'Páratlan heteken',
    even: 'Páros heteken',
};

export interface ClassDetailModalProps {
    entry: AvailableClassEntry | null;
    /** Shared-element id of the card the window zooms out of (desktop). */
    layoutId?: string;
    onClose: () => void;
}

function fmtTime(t: string): string {
    return t.slice(0, 5);
}

export default function ClassDetailModal({ entry, layoutId, onClose }: ClassDetailModalProps) {
    useEffect(() => {
        if (!entry) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [entry, onClose]);

    return (
        <AnimatePresence>
            {entry && (
                <motion.div
                    className="cdm-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="cdm-window"
                        layoutId={layoutId}
                        initial={layoutId ? undefined : { opacity: 0, scale: 0.92 }}
                        animate={layoutId ? undefined : { opacity: 1, scale: 1 }}
                        exit={layoutId ? undefined : { opacity: 0, scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        style={{ '--subject-color': getSubjectColor(entry.subject_name) } as React.CSSProperties}
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={entry.subject_name}
                    >
                        <div className="cdm-header">
                            <span className="cdm-color-dot" />
                            <h2 className="cdm-title">{entry.subject_name}</h2>
                            <button className="cdm-close" onClick={onClose} aria-label="Bezárás">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="cdm-rows">
                            {(entry.teacher_name || entry.teacher_code) && (
                                <div className="cdm-row">
                                    <span className="cdm-row-label">Tanár</span>
                                    <span className="cdm-row-value">{entry.teacher_name || entry.teacher_code}</span>
                                </div>
                            )}
                            {entry.classroom && (
                                <div className="cdm-row">
                                    <span className="cdm-row-label">Terem</span>
                                    <span className="cdm-row-value">{entry.classroom}</span>
                                </div>
                            )}
                            <div className="cdm-row">
                                <span className="cdm-row-label">Időpont</span>
                                <span className="cdm-row-value tnum">
                                    {DAY_NAMES[entry.day_of_week] ?? '?'} · {fmtTime(entry.start_time)}–{fmtTime(entry.end_time)}
                                </span>
                            </div>
                            <div className="cdm-row">
                                <span className="cdm-row-label">Hét</span>
                                <span className="cdm-row-value">{WEEK_LABEL[entry.week_type] ?? entry.week_type}</span>
                            </div>
                            {entry.class_name && (
                                <div className="cdm-row">
                                    <span className="cdm-row-label">Csoport</span>
                                    <span className="cdm-row-value">{entry.class_name}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

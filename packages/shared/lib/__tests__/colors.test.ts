import { describe, it, expect, beforeEach } from 'vitest';
import {
    DEFAULT_SUBJECT_COLORS,
    getBaseSubjectName,
    getSubjectColor,
    assignSubjectColors,
    setSubjectPalette,
    resetColorAssignments,
} from '../colors';

beforeEach(() => {
    setSubjectPalette(null);
    resetColorAssignments();
});

describe('getBaseSubjectName', () => {
    it('strips Hungarian class-type suffixes', () => {
        expect(getBaseSubjectName('Matematika I. e.a.')).toBe('matematika i.');
        expect(getBaseSubjectName('Matematika I. gyak.')).toBe('matematika i.');
        expect(getBaseSubjectName('Matematika I. szem.')).toBe('matematika i.');
        expect(getBaseSubjectName('Matematika I. lab.')).toBe('matematika i.');
    });

    it('lecture and lab of the same course share a base name', () => {
        expect(getBaseSubjectName('Szoftver tesztelés e.a.'))
            .toBe(getBaseSubjectName('Szoftver tesztelés gyak.'));
    });

    it('leaves names without a suffix intact (lowercased)', () => {
        expect(getBaseSubjectName('Testnevelés IV.')).toBe('testnevelés iv.');
    });
});

describe('subject color assignment', () => {
    it('is deterministic regardless of discovery order', () => {
        const subjects = ['Analízis e.a.', 'Fizika gyak.', 'Programozás e.a.', 'Adatbázisok szem.'];

        assignSubjectColors(subjects);
        const first = subjects.map(getSubjectColor);

        resetColorAssignments();
        assignSubjectColors([...subjects].reverse());
        const second = subjects.map(getSubjectColor);

        expect(second).toEqual(first);
    });

    it('gives the same color to lecture and lab of one course', () => {
        assignSubjectColors(['Szoftver tesztelés e.a.', 'Szoftver tesztelés gyak.']);
        expect(getSubjectColor('Szoftver tesztelés e.a.'))
            .toBe(getSubjectColor('Szoftver tesztelés gyak.'));
    });

    it('keeps subjects distinct until the palette is exhausted', () => {
        const subjects = DEFAULT_SUBJECT_COLORS.map((_, i) => `Tárgy ${i} e.a.`);
        assignSubjectColors(subjects);
        const colors = new Set(subjects.map(getSubjectColor));
        expect(colors.size).toBe(DEFAULT_SUBJECT_COLORS.length);
    });

    it('default palette contains no neon (spec §4.3 — muted, consistent brightness)', () => {
        for (const hex of DEFAULT_SUBJECT_COLORS) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            expect(saturation, `${hex} is too saturated`).toBeLessThan(0.62);
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            expect(luma, `${hex} luma out of band`).toBeGreaterThan(100);
            expect(luma, `${hex} luma out of band`).toBeLessThan(190);
        }
    });
});

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

const srgbToOklab = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const rl = lin(r), gl = lin(g), bl = lin(b);
    const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
    const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
    const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ];
};
const oklabDist = (a: [number, number, number], b: [number, number, number]) =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const oklabHueDeg = ([, a, b]: [number, number, number]) => {
    const deg = (Math.atan2(b, a) * 180) / Math.PI;
    return deg < 0 ? deg + 360 : deg;
};

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

    it('default palette entries clear a minimum perceptual distance from each other', () => {
        // v4 moved subject colour off the card body and onto a thin accent bar
        // (ClassCard.css), which inverted the old "must stay muted" constraint
        // into "must be as distinguishable as possible" — the whole reason the
        // palette carries 24 entries instead of 16. The real failure mode now
        // isn't saturation, it's two colours landing close enough to be
        // mistaken for the same subject; that's measured directly here rather
        // than through a proxy (saturation/luma) that no longer matches how
        // the palette is actually built (see the comment above
        // DEFAULT_SUBJECT_COLORS for the generation method).
        const labs = DEFAULT_SUBJECT_COLORS.map(srgbToOklab);
        let min = Infinity;
        let worst: [string, string] | null = null;
        for (let i = 0; i < labs.length; i++) {
            for (let j = i + 1; j < labs.length; j++) {
                const d = oklabDist(labs[i], labs[j]);
                if (d < min) { min = d; worst = [DEFAULT_SUBJECT_COLORS[i], DEFAULT_SUBJECT_COLORS[j]]; }
            }
        }
        // The generation method guarantees ~0.0597 (two hue-adjacent 15°
        // sectors at different lightness values — see the comment above
        // DEFAULT_SUBJECT_COLORS); 0.05 leaves a little margin for float
        // rounding without being so loose it stops catching the actual bugs
        // this replaced (ring palette worst pair ~0.029, unconstrained
        // farthest-point sampling's hue-clustering worst pair ~0.03-0.04
        // for two subjects that both happened to land in its crowded arc).
        expect(min, `closest pair ${worst?.join(' / ')} is only ${min.toFixed(4)} apart`).toBeGreaterThan(0.05);
    });

    it('default palette covers hue evenly — no clustered arc (regression: gen. 2 packed half the palette into one 96° arc)', () => {
        // The minimum-pairwise-distance test above would NOT have caught this:
        // unconstrained farthest-point sampling had a perfectly good worst-case
        // pair (~0.073) while still packing 12 of the 24 colours into one
        // blue-violet-magenta quadrant, because nothing stopped the search from
        // concentrating picks whenever a hue region tolerated more of them.
        // A student with only a handful of real subjects then had a real chance
        // of several landing in that one crowded arc — which is what happened.
        // This checks the actual distribution: sorted around the hue circle,
        // no gap between consecutive colours should be wildly larger than the
        // 15° an even 24-way split implies (some spread is expected — hue
        // shifts slightly under gamut clipping — but a ~96°/12-colour pileup
        // would show up as several ~0° gaps opposite one huge empty gap).
        const hues = DEFAULT_SUBJECT_COLORS.map(hex => oklabHueDeg(srgbToOklab(hex))).sort((a, b) => a - b);
        const gaps = hues.map((h, i) => {
            const next = hues[(i + 1) % hues.length];
            return (next - h + 360) % 360 || 360;
        });
        const maxGap = Math.max(...gaps);
        // Even coverage → every gap ~15°. Generous ceiling (2x) still fails
        // hard for a clustered palette, where the "hole" left by a pileup
        // spans 60-100°+.
        expect(maxGap, `largest hue gap is ${maxGap.toFixed(1)}° — colours are clustering`).toBeLessThan(30);
    });
});

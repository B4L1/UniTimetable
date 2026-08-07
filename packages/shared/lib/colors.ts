// Subject colour palette. Shared by web, mobile app and widget so the same
// subject renders the same colour everywhere. Each unique subject (base name)
// gets a colour via deterministic hash assignment (see getSubjectColor).
//
// ── Why these values (v4 redesign) ──────────────────────────────────────
// The old palette was deliberately muted because the colour WAS the card
// background — anything saturated made the text on top unreadable, and the
// price was 16 tints that were genuinely hard to tell apart.
//
// Cards are now neutral with a 3px accent bar (see ClassCard.css), so the
// colour is a small graphic element rather than a text background. That
// inverts the constraint: the palette should be as *distinguishable* as
// possible, and only needs to clear non-text contrast against the surface.
//
// v4 went through two generations before this one, both of which produced
// colours that were too easy to confuse for a different subject:
//
// 1. 24 evenly-spaced hues (15° apart) at one fixed lightness/chroma. Reads
//    as "evenly spaced" but isn't: 24 points on one hue ring put adjacent
//    colours only ~0.03 apart in OKLab, and several pairs (two different
//    teals, two different ambers) were close enough to be mistaken for the
//    same subject.
// 2. Farthest-point sampling — greedily add whichever in-gamut candidate is
//    farthest (in OKLab) from every colour already picked, which pushed the
//    WORST pair in the whole set out to ~0.073. That guarantee turned out
//    not to be the thing that mattered: the search packed 12 of the 24
//    colours into a single 96°-wide blue→violet→magenta→pink arc (that hue
//    range tolerates more distinguishable near-max-chroma steps at this
//    lightness than oranges or greens do), because nothing constrained
//    *where* the picks landed, only how far apart they were. A student with
//    5 real subjects had a real chance of 3 of them landing in that one
//    quadrant — which is exactly what happened.
//
// This version fixes the actual problem — unpredictable hue clustering —
// by constraining hue directly: one colour per 15° sector, no exceptions,
// so no two colours can ever be closer than 15° in hue by construction.
// Lightness cycles through {0.55, 0.605, 0.66} across sectors as a second
// separation axis (adjacent sectors always land on different lightness
// values), which lifts the worst-case distance for two hue-neighbours well
// above the old ring's baseline even in the unlucky case where a hash
// assignment picks two adjacent sectors. Chroma is ~97% of each hue's
// in-gamut max at its lightness, so saturation stays consistently vivid.
// Guaranteed minimum pairwise OKLab distance: 0.0597 (vs. ~0.029 for
// generation 1) — see colors.test.ts. Contrast against the card surface
// clears both themes (≥3.4:1 dark, ≥2.9:1 light).
//
// The list order is a stride-11 walk over the 24 hue sectors (coprime with
// 24, so consecutive array entries sit ~165° apart) — carried over from
// generation 1 for the same reason: assignColor() probes forward linearly
// on a hash collision, and this keeps probe-adjacent entries far apart too.
export const DEFAULT_SUBJECT_COLORS = [
    '#CB116C',
    '#16AB7D',
    '#D115CB',
    '#45840C',
    '#A86BFC',
    '#8D850F',
    '#4158FB',
    '#C28412',
    '#118AC9',
    '#B64D0B',
    '#16A4B7',
    '#EC1552',
    '#0F8474',
    '#F918B7',
    '#129B49',
    '#A812D7',
    '#879F13',
    '#7B63FB',
    '#8A6E0C',
    '#3992FC',
    '#BC6A0F',
    '#0E7D9E',
    '#FC4734',
    '#129494',
];

let activePalette = [...DEFAULT_SUBJECT_COLORS];

// Cache of subject → color. Assignment is deterministic (hash-based), so any
// JS context (web, mobile app, Android widget) computes the same colors for
// the same subject set — see getSubjectColor / assignSubjectColors below.
const colorAssignments = new Map<string, string>();

export function setSubjectPalette(colors: string[] | null): void {
    if (!colors || colors.length === 0) {
        activePalette = [...DEFAULT_SUBJECT_COLORS];
    } else {
        activePalette = [...colors];
    }
    resetColorAssignments();
}

// FNV-1a — small, fast, stable string hash
function hashString(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

// Extract base subject name by removing common suffixes like "e.a.", "szem.", "gyak.", etc.
export function getBaseSubjectName(fullName: string): string {
    let baseName = fullName.trim();

    // Common Hungarian class type patterns to remove
    // Matches: "e.a.", "gyak.", "szem.", "lab.", "koll." at the end (with optional space before)
    const pattern = /\s+(e\.a\.|gyak\.|szem\.|lab\.|koll\.)$/i;

    baseName = baseName.replace(pattern, '');

    return baseName.trim().toLowerCase(); // Normalize to lowercase for consistent matching
}

// Internal: deterministically pick a color for a base name.
// Starts at hash(name) % palette size, then probes forward past colors that
// are already taken so subjects stay visually distinct until the palette is
// exhausted.
//
// Guarantee: two JS contexts that assign the SAME subject set via a single
// assignSubjectColors() call produce identical colors (this is how the mobile
// app and the Android widget stay in sync — both assign the full cached
// timetable at once). Assigning in different batch splits can diverge on the
// rare hash collision, so always prefer one batch call over ad-hoc lookups.
function assignColor(baseName: string): string {
    const used = new Set(colorAssignments.values());
    let idx = hashString(baseName) % activePalette.length;

    if (used.size < activePalette.length) {
        while (used.has(activePalette[idx])) {
            idx = (idx + 1) % activePalette.length;
        }
    }

    const color = activePalette[idx];
    colorAssignments.set(baseName, color);
    return color;
}

/**
 * Pre-assign colors for a whole subject set at once (sorted, so the result
 * is independent of the order the caller discovered the subjects in).
 * Call this after loading timetable data; getSubjectColor then just looks up.
 */
export function assignSubjectColors(subjectNames: string[]): void {
    const baseNames = Array.from(new Set(subjectNames.map(getBaseSubjectName))).sort();
    for (const baseName of baseNames) {
        if (!colorAssignments.has(baseName)) {
            assignColor(baseName);
        }
    }
}

// Get a color for a subject name (deterministic hash-based assignment)
export function getSubjectColor(subjectName: string): string {
    const baseName = getBaseSubjectName(subjectName);

    if (colorAssignments.has(baseName)) {
        return colorAssignments.get(baseName)!;
    }

    return assignColor(baseName);
}

// Reset color assignments (useful for testing or when the palette changes)
export function resetColorAssignments(): void {
    colorAssignments.clear();
}

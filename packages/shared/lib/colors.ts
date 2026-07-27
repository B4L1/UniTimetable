// Muted color palette for timetable entries (spec v3 §4.3: muted tones,
// consistent brightness, no neon). Shared by web, mobile app and widget so
// the same subject renders the same color everywhere.
// Each unique subject (base name) gets a unique color via deterministic assignment.

export const DEFAULT_SUBJECT_COLORS = [
    '#719EB5', // Muted Blue
    '#7CA193', // Sage Green
    '#C66953', // Terracotta
    '#968DCA', // Soft Purple
    '#E99F79', // Peach
    '#89B4B4', // Dusty Teal
    '#C48696', // Dusty Rose
    '#D0A55D', // Muted Gold
    '#92A374', // Faded Olive
    '#7D8DAB', // Dusty Indigo
    '#B49082', // Warm Taupe
    '#8FA4C2', // Periwinkle
    '#A88BB8', // Faded Lilac
    '#6FA287', // Eucalyptus
    '#C79A83', // Clay
    '#849BB0', // Slate Blue
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

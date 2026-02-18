// Bold color palette for timetable entries
// Each unique subject (base name) gets a unique color via sequential assignment

export const DEFAULT_SUBJECT_COLORS = [
    // Cool & Bold
    '#3A86FF', // Electric Blue
    '#00D1FF', // Vivid Cyan
    '#8338EC', // Royal Purple
    '#BE4BFF', // Bright Violet
    '#008080', // Deep Teal
    '#2EC4B6', // Neon Mint
    '#20BF55', // Jungle Green
    // Warm & Energetic
    '#FF006E', // Dragon Fruit
    '#FB5607', // Hot Pink
    '#FF7F50', // Sunset Orange
    '#FF4D6D', // Electric Coral
    '#FFBE0B', // Golden Yellow
    '#FFD100', // Sunflower
    '#FF9F1C', // Mango
    // Rich & Earthy
    '#D90429', // Raspberry
    '#4361EE', // Indigo
    '#9B5DE5', // Amethyst
    '#EF233C', // Candy Apple
    '#023E8A', // Cobalt
    '#A44CD3', // Deep Orchid
];

let activePalette = [...DEFAULT_SUBJECT_COLORS];

// Cache for sequential color assignments - ensures each subject gets a unique color
const colorAssignments = new Map<string, string>();
let nextColorIndex = 0;

export function setSubjectPalette(colors: string[] | null): void {
    if (!colors || colors.length === 0) {
        activePalette = [...DEFAULT_SUBJECT_COLORS];
    } else {
        activePalette = [...colors];
    }
    resetColorAssignments();
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

// Get a unique color for a subject name (sequential assignment, no duplicates)
export function getSubjectColor(subjectName: string): string {
    const baseName = getBaseSubjectName(subjectName);

    // If this subject already has a color assigned, return it
    if (colorAssignments.has(baseName)) {
        return colorAssignments.get(baseName)!;
    }

    // Assign the next available color
    const color = activePalette[nextColorIndex % activePalette.length];
    colorAssignments.set(baseName, color);
    nextColorIndex++;

    return color;
}

// Reset color assignments (useful for testing or when data changes)
export function resetColorAssignments(): void {
    colorAssignments.clear();
    nextColorIndex = 0;
}

export function formatClassName(name: string): string {
    if (!name) return '';
    // Split by dot and take the first part to remove group codes like "III.B.-14"
    // Example: "Informatika III.B.-14" -> "Informatika III"
    return name.split('.')[0];
}

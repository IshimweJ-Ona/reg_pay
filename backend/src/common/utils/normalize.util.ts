/**
 * Normalize an entity name to a comparable canonical form.
 * Used for near-duplicate detection across the system.
 * Strips whitespace/underscores/hyphens to a single space, lowercases, and trims.
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a new input is a near-duplicate of any existing name in a list.
 * Returns the matched duplicate name if found, or null if no match.
 * @param newName - The name being created/updated
 * @param existingNames - Array of existing name strings to check against
 * @param excludeName - Optional name to exclude from comparison (for updates)
 */
export function findNearDuplicate(
  newName: string,
  existingNames: string[],
  excludeName?: string,
): string | null {
  const normalizedNew = normalizeName(newName);
  if (!normalizedNew) return null;

  const normalizedExclude = excludeName ? normalizeName(excludeName) : null;

  for (const existing of existingNames) {
    if (normalizedExclude && normalizeName(existing) === normalizedExclude) {
      continue; // Skip the current entity when updating
    }
    if (normalizeName(existing) === normalizedNew) {
      return existing;
    }
  }

  return null;
}
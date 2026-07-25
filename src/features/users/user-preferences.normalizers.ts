/**
 * Normalizes a locale string to a consistent BCP 47 format if possible.
 *
 * @param locale Raw locale string
 * @returns Trimmed and case-normalized locale
 */
export function normalizeLocale(locale: string): string {
  const trimmed = locale.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    // Attempt to use Intl to resolve the canonical locale
    return new Intl.Locale(trimmed).baseName;
  } catch {
    // Fallback if Intl fails to parse it
    return trimmed;
  }
}

/**
 * Normalizes a time zone string.
 *
 * @param timeZone Raw time zone string
 * @returns Trimmed time zone string
 */
export function normalizeTimeZone(timeZone: string): string {
  return timeZone.trim();
}

/**
 * Normalizes an optional string field according to P3.1 rules:
 * - Trims leading and trailing whitespace.
 * - If the result is an empty string, normalizes to `null`.
 */
export function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes a required string field (like fullName):
 * - Trims leading and trailing whitespace.
 * - Returns the trimmed string (validation will catch if it's empty, but we must return it).
 */
export function normalizeRequiredString(value: string): string {
  return value.trim();
}

/**
 * Normalizes the preferredRoles array according to P3.1 rules:
 * - Null normalizes to an empty array.
 * - Trims each item.
 * - Deduplicates values while preserving the first occurrence order.
 * - Removes empty strings (validation rejects them if present, but we should probably preserve empty strings so validation can reject them, or maybe the normalizer doesn't filter them so the schema can reject them as required by "Empty role strings after trimming must be rejected").
 * Actually, the requirement says "Empty role strings after trimming must be rejected". So we must return them so validation catches it, or throw an error? Validation should catch it.
 */
export function normalizePreferredRoles(roles: string[] | null | undefined): string[] {
  if (roles === null || roles === undefined) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const role of roles) {
    const trimmed = role.trim();
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }

  return normalized;
}

/**
 * Presentation-only birthdate helper. The authoritative adult eligibility and
 * account lock must always be decided by POST /api/account/alter.
 *
 * A three-field entry avoids decades of scrolling in mobile date pickers.
 * No date or error is saved in browser storage or logged here.
 */
export function birthdateFromParts(day: string, month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return null;
  }
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m
      || date.getUTCDate() !== d) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function partsFromBirthdate(isoDate: string): { day: string; month: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match || birthdateFromParts(match[3], match[2], match[1]) !== isoDate) return null;
  return { day: String(Number(match[3])), month: match[2], year: match[1] };
}

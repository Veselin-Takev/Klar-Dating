export const DATING_JOURNAL_NOTES_MAX_CHARS = 4000;
export const DATING_JOURNAL_MAX_VIBES = 8;

export const DATING_JOURNAL_VIBES = [
  'Aufregend',
  'Entspannt',
  'Unangenehm',
  'Tiefgründig',
  'Oberflächlich',
  'Romantisch',
  'Freundschaftlich',
  'Langweilig',
] as const;

export type DatingJournalVibe = typeof DATING_JOURNAL_VIBES[number];

export type DatingJournalAnalysisInput = {
  notes: string;
  vibes: DatingJournalVibe[];
};

export function parseDatingJournalAnalysisInput(value: unknown): DatingJournalAnalysisInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { notes?: unknown; vibes?: unknown };

  if (typeof body.notes !== 'string') return null;
  const notes = body.notes.trim();
  if (!notes || notes.length > DATING_JOURNAL_NOTES_MAX_CHARS) return null;

  if (!Array.isArray(body.vibes) || body.vibes.length > DATING_JOURNAL_MAX_VIBES) return null;
  const allowed = new Set<string>(DATING_JOURNAL_VIBES);
  const vibes: DatingJournalVibe[] = [];
  for (const raw of body.vibes) {
    if (typeof raw !== 'string' || !allowed.has(raw)) return null;
    if (!vibes.includes(raw as DatingJournalVibe)) vibes.push(raw as DatingJournalVibe);
  }

  return { notes, vibes };
}

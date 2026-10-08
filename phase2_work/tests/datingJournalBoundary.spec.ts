import { describe, expect, it } from 'vitest';
import {
  DATING_JOURNAL_NOTES_MAX_CHARS,
  parseDatingJournalAnalysisInput,
} from '../src/server/platform/datingJournalBoundary';

describe('dating journal analysis input boundary', () => {
  it('accepts trimmed notes and known vibe tags', () => {
    expect(parseDatingJournalAnalysisInput({
      notes: '  Nettes Date  ',
      vibes: ['Entspannt', 'Romantisch', 'Entspannt'],
    })).toEqual({
      notes: 'Nettes Date',
      vibes: ['Entspannt', 'Romantisch'],
    });
  });

  it.each([
    null,
    {},
    { notes: 42, vibes: [] },
    { notes: '', vibes: [] },
    { notes: 'x'.repeat(DATING_JOURNAL_NOTES_MAX_CHARS + 1), vibes: [] },
    { notes: 'ok', vibes: 'Entspannt' },
    { notes: 'ok', vibes: ['Unbekannt'] },
    { notes: 'ok', vibes: [42] },
    { notes: 'ok', vibes: Array.from({ length: 9 }, () => 'Entspannt') },
  ])('rejects malformed or oversized inputs', value => {
    expect(parseDatingJournalAnalysisInput(value)).toBeNull();
  });
});

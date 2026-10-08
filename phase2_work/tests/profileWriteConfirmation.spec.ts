import { describe, expect, it } from 'vitest';
import { omitUndefinedFields, profileContainsExpectedFields } from '../src/lib/profileWriteConfirmation';

describe('profile write confirmation helpers', () => {
  it('omits only undefined top-level fields and preserves explicit null values', () => {
    expect(omitUndefinedFields({
      interests: ['Musik'],
      musicPreferences: undefined,
      photoURL: null,
    })).toEqual({
      interests: ['Musik'],
      photoURL: null,
    });
  });

  it('confirms only the fields written by the current update', () => {
    expect(profileContainsExpectedFields(
      {
        uid: 'user-1',
        interests: ['Musik', 'Reisen'],
        musicPreferences: {
          genres: ['Jazz'],
          concertGoer: true,
          playingInstrument: false,
        },
        updatedAt: 'later-write',
      },
      {
        interests: ['Musik', 'Reisen'],
        musicPreferences: {
          playingInstrument: false,
          concertGoer: true,
          genres: ['Jazz'],
        },
      },
    )).toBe(true);
  });

  it('fails closed when a written field differs on the server', () => {
    expect(profileContainsExpectedFields(
      {
        interests: ['Musik'],
        musicPreferences: {
          genres: ['Jazz'],
          concertGoer: false,
          playingInstrument: false,
        },
      },
      {
        interests: ['Musik'],
        musicPreferences: {
          genres: ['Jazz'],
          concertGoer: true,
          playingInstrument: false,
        },
      },
    )).toBe(false);
  });

  it('does not treat extra nested fields as the exact persisted value', () => {
    expect(profileContainsExpectedFields(
      {
        musicPreferences: {
          genres: ['Jazz'],
          concertGoer: true,
          playingInstrument: false,
          unexpected: true,
        },
      },
      {
        musicPreferences: {
          genres: ['Jazz'],
          concertGoer: true,
          playingInstrument: false,
        },
      },
    )).toBe(false);
  });
});

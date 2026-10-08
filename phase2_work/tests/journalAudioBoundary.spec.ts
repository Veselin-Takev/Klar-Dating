import { describe, expect, it } from 'vitest';
import {
  JOURNAL_AUDIO_MAX_BYTES,
  parseJournalAudioInput,
  parseJournalAudioOutput,
} from '../src/server/platform/journalAudioBoundary';

function b64(bytes: number): string {
  return Buffer.alloc(bytes, 1).toString('base64');
}

describe('journal audio input boundary', () => {
  it('accepts a bounded supported audio payload and normalizes codec parameters', () => {
    const audioBase64 = b64(1024);
    expect(parseJournalAudioInput({ audioBase64, mimeType: 'audio/webm;codecs=opus' })).toEqual({
      audioBase64,
      mimeType: 'audio/webm',
    });
  });

  it.each([
    null,
    {},
    { audioBase64: '***', mimeType: 'audio/webm' },
    { audioBase64: b64(100), mimeType: 'video/webm' },
    { audioBase64: b64(JOURNAL_AUDIO_MAX_BYTES + 1), mimeType: 'audio/webm' },
  ])('rejects malformed, unsupported or oversized audio', value => {
    expect(parseJournalAudioInput(value)).toBeNull();
  });
});

describe('journal audio output boundary', () => {
  const valid = {
    transcript: 'Das war ein schönes Date.',
    mood: 'positive',
    moodInsight: 'Die Aufnahme wirkt ruhig und positiv.',
  };

  it('accepts a complete bounded result', () => {
    expect(parseJournalAudioOutput(valid)).toEqual(valid);
  });

  it.each([
    { ...valid, transcript: '' },
    { ...valid, mood: 'happy' },
    { ...valid, moodInsight: '' },
    { ...valid, transcript: 'x'.repeat(12001) },
    { ...valid, moodInsight: 'x'.repeat(2001) },
  ])('rejects incomplete or implausible model output', value => {
    expect(parseJournalAudioOutput(value)).toBeNull();
  });
});

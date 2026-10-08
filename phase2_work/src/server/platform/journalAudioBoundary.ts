export const JOURNAL_AUDIO_MAX_BYTES = 600 * 1024;
export const JOURNAL_AUDIO_MAX_TRANSCRIPT_CHARS = 12_000;
export const JOURNAL_AUDIO_MAX_INSIGHT_CHARS = 2_000;

export const JOURNAL_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
] as const;

export type JournalAudioInput = {
  audioBase64: string;
  mimeType: typeof JOURNAL_AUDIO_MIME_TYPES[number];
};

export type JournalAudioOutput = {
  transcript: string;
  mood: 'positive' | 'neutral' | 'negative';
  moodInsight: string;
};

function decodedBase64Bytes(value: string): number | null {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

export function parseJournalAudioInput(value: unknown): JournalAudioInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { audioBase64?: unknown; mimeType?: unknown };

  if (typeof body.audioBase64 !== 'string' || typeof body.mimeType !== 'string') return null;
  const [rawMimeType] = body.mimeType.split(';', 1);
  if (!rawMimeType) return null;
  const mimeType = rawMimeType.trim().toLowerCase();
  if (!(JOURNAL_AUDIO_MIME_TYPES as readonly string[]).includes(mimeType)) return null;

  const bytes = decodedBase64Bytes(body.audioBase64);
  if (bytes === null || bytes <= 0 || bytes > JOURNAL_AUDIO_MAX_BYTES) return null;

  return {
    audioBase64: body.audioBase64,
    mimeType: mimeType as JournalAudioInput['mimeType'],
  };
}

export function parseJournalAudioOutput(value: unknown): JournalAudioOutput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;

  if (typeof body.transcript !== 'string') return null;
  const transcript = body.transcript.trim();
  if (!transcript || transcript.length > JOURNAL_AUDIO_MAX_TRANSCRIPT_CHARS) return null;

  if (body.mood !== 'positive' && body.mood !== 'neutral' && body.mood !== 'negative') return null;

  if (typeof body.moodInsight !== 'string') return null;
  const moodInsight = body.moodInsight.trim();
  if (!moodInsight || moodInsight.length > JOURNAL_AUDIO_MAX_INSIGHT_CHARS) return null;

  return { transcript, mood: body.mood, moodInsight };
}

export class JournalRequestError extends Error {
  constructor(public readonly kind: 'limit' | 'timeout' | 'service' | 'invalid') {
    super(kind);
  }
}

export async function requestJournalAI(path: string, payload: unknown, timeoutMs = 15000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.status === 429) throw new JournalRequestError('limit');
    if (!response.ok) throw new JournalRequestError('service');
    const data: unknown = await response.json().catch(() => null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new JournalRequestError('invalid');
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof JournalRequestError) throw error;
    if (controller.signal.aborted) throw new JournalRequestError('timeout');
    throw new JournalRequestError('service');
  } finally {
    clearTimeout(timeout);
  }
}

export function journalErrorMessage(error: unknown): string {
  if (error instanceof JournalRequestError) {
    if (error.kind === 'limit') return 'Dein KI-Kontingent ist derzeit aufgebraucht. Deine Notizen bleiben erhalten; bitte versuche es später erneut.';
    if (error.kind === 'timeout') return 'Die KI antwortet gerade nicht. Deine Notizen bleiben erhalten; bitte versuche es erneut.';
    if (error.kind === 'invalid') return 'Die KI-Antwort konnte nicht verarbeitet werden. Deine Notizen bleiben erhalten.';
  }
  return 'Die KI-Auswertung ist gerade nicht verfügbar. Deine Notizen bleiben erhalten.';
}

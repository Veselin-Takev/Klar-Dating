import { Router, type Request } from 'express';
import { Type } from '@google/genai';
import type { Antwort } from '../kiPolitik';

const MAX_INTERESTS = 30;
const MAX_PROFILES = 20;
const MAX_INTEREST_CHARS = 80;
const MAX_NAME_CHARS = 120;
const MAX_BIO_CHARS = 2000;

type ProfileInput = {
  id: string;
  name: string;
  bio: string;
  interests: string[];
};

type RequestInput = {
  userInterests: string[];
  profiles: ProfileInput[];
};

export type AiPassgenauigkeitRouterDeps = {
  currentUserId: (req: Request) => string | null;
  answer: (
    endpoint: string,
    call: (signal: AbortSignal) => Promise<{ text?: string | null }>,
  ) => Promise<Antwort>;
  generate: (parameters: Record<string, unknown>) => Promise<{ text?: string | null }>;
  modelName: () => string;
};

function boundedStrings(value: unknown, maxItems: number, maxChars: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const text = item.trim();
    if (!text || text.length > maxChars) return null;
    out.push(text);
  }
  return out;
}

export function parseAiPassgenauigkeitInput(value: unknown): RequestInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { userInterests?: unknown; profiles?: unknown };

  const userInterests = boundedStrings(body.userInterests, MAX_INTERESTS, MAX_INTEREST_CHARS);
  if (!userInterests || !Array.isArray(body.profiles) || body.profiles.length === 0 || body.profiles.length > MAX_PROFILES) {
    return null;
  }

  const ids = new Set<string>();
  const profiles: ProfileInput[] = [];
  for (const raw of body.profiles) {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return null;
    if (p.bio !== undefined && p.bio !== null && typeof p.bio !== 'string') return null;

    const id = p.id.trim();
    const name = p.name.trim();
    const bio = typeof p.bio === 'string' ? p.bio.trim() : '';
    const interests = boundedStrings(p.interests, MAX_INTERESTS, MAX_INTEREST_CHARS);
    if (!id || id.length > 128 || ids.has(id) || !name || name.length > MAX_NAME_CHARS || bio.length > MAX_BIO_CHARS || !interests) {
      return null;
    }
    ids.add(id);
    profiles.push({ id, name, bio, interests });
  }

  return { userInterests, profiles };
}

export function validatedScores(raw: unknown, allowedIds: Set<string>) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: Array<{ id: string; score: number; reason: string }> = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const value = item as Record<string, unknown>;
    if (typeof value.id !== 'string' || !allowedIds.has(value.id) || seen.has(value.id)) return null;
    if (typeof value.score !== 'number' || !Number.isInteger(value.score) || value.score < 0 || value.score > 100) return null;
    if (typeof value.reason !== 'string') return null;
    const reason = value.reason.trim();
    if (!reason || reason.length > 500) return null;
    seen.add(value.id);
    out.push({ id: value.id, score: value.score, reason });
  }

  return out.length === allowedIds.size ? out : null;
}

export function createAiPassgenauigkeitRouter(deps: AiPassgenauigkeitRouterDeps): Router {
  const router = Router();

  router.post('/ai-passgenauigkeit', async (req, res) => {
    const uid = deps.currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const input = parseAiPassgenauigkeitInput(req.body);
    if (!input) return res.status(400).json({ error: 'Ungültige oder zu große Passgenauigkeitsdaten.' });

    const allowedIds = new Set(input.profiles.map(profile => profile.id));
    const answer = await deps.answer(
      '/api/ai-passgenauigkeit',
      signal => deps.generate({
        model: deps.modelName(),
        contents: [
          'Bewerte die Passung ausschließlich anhand der übergebenen Interessen, Bio und Profilangaben.',
          'Keine fehlenden Eigenschaften erfinden. Gib für jedes Profil exakt einen Eintrag zurück.',
          `Interessen der suchenden Person: ${input.userInterests.join(', ')}`,
          ...input.profiles.map(profile =>
            `Profil ${profile.id} — ${profile.name}; Bio: ${profile.bio || '(leer)'}; Interessen: ${profile.interests.join(', ')}`
          ),
        ].join('\n'),
        config: {
          abortSignal: signal,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    score: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                  },
                  required: ['id', 'score', 'reason'],
                },
              },
            },
            required: ['scores'],
          },
        },
      }),
    );

    if (answer.status !== 200) return res.status(answer.status).json(answer.koerper);

    const scores = validatedScores(answer.koerper.scores, allowedIds);
    if (!scores) {
      return res.status(502).json({
        herkunft: 'keine',
        code: 'ki_ungueltig',
        error: 'Das Ergebnis war unbrauchbar.',
      });
    }

    return res.json(scores);
  });

  return router;
}

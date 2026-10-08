import { describe, expect, it, vi } from 'vitest';
import { parseAiPassgenauigkeitInput, createAiPassgenauigkeitRouter, validatedScores } from '../src/server/routes/aiPassgenauigkeit';
import express from 'express';
import type { AddressInfo } from 'node:net';

describe('ai passgenauigkeit input', () => {
  it('accepts a bounded valid request', () => {
    expect(parseAiPassgenauigkeitInput({
      userInterests: [' Wandern '],
      profiles: [{ id: 'p1', name: 'Alex', bio: '', interests: ['Kochen'] }],
    })).toEqual({
      userInterests: ['Wandern'],
      profiles: [{ id: 'p1', name: 'Alex', bio: '', interests: ['Kochen'] }],
    });
  });

  it('normalizes a missing optional bio to empty text', () => {
    expect(parseAiPassgenauigkeitInput({
      userInterests: ['Wandern'],
      profiles: [{ id: 'p1', name: 'Alex', interests: ['Kochen'] }],
    })).toEqual({
      userInterests: ['Wandern'],
      profiles: [{ id: 'p1', name: 'Alex', bio: '', interests: ['Kochen'] }],
    });
  });

  it.each([
    null,
    {},
    { userInterests: 'Wandern', profiles: [] },
    { userInterests: [], profiles: [] },
    { userInterests: ['x'], profiles: [{ id: 'p1', name: '', bio: '', interests: [] }] },
    { userInterests: ['x'], profiles: [{ id: 'p1', name: 'A', bio: '', interests: [] }, { id: 'p1', name: 'B', bio: '', interests: [] }] },
    { userInterests: ['x'.repeat(81)], profiles: [{ id: 'p1', name: 'A', bio: '', interests: [] }] },
  ])('rejects malformed requests', value => {
    expect(parseAiPassgenauigkeitInput(value)).toBeNull();
  });
});

describe('ai passgenauigkeit output', () => {
  const ids = new Set(['p1', 'p2']);

  it('accepts exactly one bounded score per requested profile', () => {
    expect(validatedScores([
      { id: 'p1', score: 82, reason: ' Gemeinsame Interessen ' },
      { id: 'p2', score: 40, reason: 'Wenige Überschneidungen' },
    ], ids)).toEqual([
      { id: 'p1', score: 82, reason: 'Gemeinsame Interessen' },
      { id: 'p2', score: 40, reason: 'Wenige Überschneidungen' },
    ]);
  });

  it('rejects incomplete or invalid model output', () => {
    const invalidOutputs: unknown[] = [
      [{ id: 'p1', score: 82, reason: 'ok' }],
      [{ id: 'p1', score: 82, reason: 'ok' }, { id: 'p1', score: 70, reason: 'dup' }],
      [{ id: 'p1', score: 101, reason: 'bad' }, { id: 'p2', score: 40, reason: 'ok' }],
      [{ id: 'p1', score: 82.5, reason: 'bad' }, { id: 'p2', score: 40, reason: 'ok' }],
      [{ id: 'p1', score: 82, reason: 'ok' }, { id: 'unknown', score: 40, reason: 'bad' }],
    ];

    for (const value of invalidOutputs) {
      expect(validatedScores(value, ids)).toBeNull();
    }
  });
});

describe('ai passgenauigkeit endpoint', () => {
  it('returns the dashboard list shape only after strict model validation', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createAiPassgenauigkeitRouter({
      currentUserId: () => 'u1',
      answer: async (_endpoint, call) => {
        await call(new AbortController().signal);
        return { status: 200, koerper: { scores: [{ id: 'p1', score: 82, reason: 'Gemeinsame Interessen' }], herkunft: 'ki' } };
      },
      generate: vi.fn(async () => ({ text: '{}' })),
      modelName: () => 'test-model',
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/ai-passgenauigkeit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userInterests: ['Wandern'],
          profiles: [{ id: 'p1', name: 'Alex', bio: '', interests: ['Wandern'] }],
        }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([{ id: 'p1', score: 82, reason: 'Gemeinsame Interessen' }]);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it('fails closed on incomplete model scores', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createAiPassgenauigkeitRouter({
      currentUserId: () => 'u1',
      answer: async () => ({ status: 200, koerper: { scores: [], herkunft: 'ki' } }),
      generate: vi.fn(async () => ({ text: '{}' })),
      modelName: () => 'test-model',
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/ai-passgenauigkeit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userInterests: ['Wandern'],
          profiles: [{ id: 'p1', name: 'Alex', bio: '', interests: ['Wandern'] }],
        }),
      });
      expect(response.status).toBe(502);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});

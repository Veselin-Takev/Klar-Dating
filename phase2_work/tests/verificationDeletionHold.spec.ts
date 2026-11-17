// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { Firestore } from 'firebase-admin/firestore';

const holdMocks = vi.hoisted(() => ({
  readVerificationDeletionFence: vi.fn(),
  beginVerificationDeletionHold: vi.fn(),
  confirmVerificationDeletionHold: vi.fn(),
}));

vi.mock('../src/server/platform/verificationDeletionFence', () => ({
  readVerificationDeletionFence: holdMocks.readVerificationDeletionFence,
  beginVerificationDeletionHold: holdMocks.beginVerificationDeletionHold,
  confirmVerificationDeletionHold: holdMocks.confirmVerificationDeletionHold,
}));

import { createVerificationDeletionHoldRouter } from '../src/server/routes/verificationDeletionHold';

const OBJECT_KEY = 'a'.repeat(64);
const REQUEST_ID = 'hold-request-773';

const fence = {
  schemaVersion: 1,
  uid: 'user-1',
  challengeId: 'challenge-773',
  bucket: 'synthetic-verification-bucket',
  storagePath: 'verification/user-1/photo.jpg',
  objectKey: OBJECT_KEY,
  observedGeneration: '773',
  observedMetageneration: '11',
  decisionVersion: 2,
  holdVersion: 0,
  state: 'eligible',
  legalHoldActive: false,
  moderationHoldActive: false,
  accountErasureActive: false,
  reservationToken: null,
  reservationOwner: null,
  reservedAt: null,
  reservationExpiresAt: null,
  decisionReason: null,
  createdAt: {},
  updatedAt: {},
  lastTransitionAt: {},
  lastTransitionBy: 'test',
  attemptCount: 0,
  lastErrorCode: null,
  deletedAt: null,
  deletedGeneration: null,
};

function makeFile(initial: Record<string, unknown>) {
  let current = { ...initial };
  const getMetadata = vi.fn(async () => [{ ...current }]);
  const setMetadata = vi.fn(async (
    metadata: { temporaryHold: true },
    options: { ifGenerationMatch: string | number; ifMetagenerationMatch: string | number },
  ) => {
    expect(metadata).toEqual({ temporaryHold: true });
    expect(options).toEqual({
      ifGenerationMatch: '773',
      ifMetagenerationMatch: '11',
    });
    current = {
      ...current,
      temporaryHold: true,
      metageneration: '12',
    };
    return [{ ...current }];
  });
  return { file: { getMetadata, setMetadata }, getMetadata, setMetadata };
}

async function postHold(input: {
  file: ReturnType<typeof makeFile>['file'];
  role?: string;
  body?: Record<string, unknown>;
}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { uid: 'moderator-1', role: input.role ?? 'moderator' } as typeof req.user;
    next();
  });
  app.use(createVerificationDeletionHoldRouter({
    getDb: () => ({} as Firestore),
    getBucket: name => ({
      name,
      file: () => input.file,
    }),
  }));

  let server: Server | undefined;
  try {
    server = await new Promise<Server>(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing_test_listener');
    const response = await fetch(`http://127.0.0.1:${address.port}/verification-deletion/hold`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.body ?? {
        objectKey: OBJECT_KEY,
        holdField: 'moderationHoldActive',
        requestId: REQUEST_ID,
      }),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  } finally {
    if (server) await new Promise<void>((resolve, reject) => {
      server!.close(error => error ? reject(error) : resolve());
    });
  }
}

describe('POST /verification-deletion/hold', () => {
  beforeEach(() => {
    holdMocks.readVerificationDeletionFence.mockReset().mockResolvedValue(fence);
    holdMocks.beginVerificationDeletionHold.mockReset().mockResolvedValue({
      ...fence,
      state: 'hold_pending',
      pendingHoldField: 'moderationHoldActive',
      holdRequestId: REQUEST_ID,
    });
    holdMocks.confirmVerificationDeletionHold.mockReset().mockResolvedValue({
      ...fence,
      state: 'held',
      moderationHoldActive: true,
      holdVersion: 1,
    });
  });

  it('writes the GCS temporary hold with both CAS preconditions before Firestore confirmation', async () => {
    const file = makeFile({
      generation: '773',
      metageneration: '11',
      temporaryHold: false,
    });

    const response = await postHold({ file: file.file });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, state: 'held', holdField: 'moderationHoldActive' });
    expect(file.setMetadata).toHaveBeenCalledTimes(1);
    expect(holdMocks.beginVerificationDeletionHold).toHaveBeenCalledWith(expect.anything(), {
      objectKey: OBJECT_KEY,
      holdField: 'moderationHoldActive',
      actor: 'moderator-1',
      requestId: REQUEST_ID,
    });
    expect(holdMocks.beginVerificationDeletionHold.mock.invocationCallOrder[0])
      .toBeLessThan(file.setMetadata.mock.invocationCallOrder[0]);
    expect(file.setMetadata.mock.invocationCallOrder[0])
      .toBeLessThan(holdMocks.confirmVerificationDeletionHold.mock.invocationCallOrder[0]);
  });

  it('maps GCS 412 to HTTP 409 and never confirms a failed GCS barrier', async () => {
    const file = makeFile({
      generation: '773',
      metageneration: '11',
      temporaryHold: false,
    });
    file.setMetadata.mockRejectedValue(Object.assign(new Error('precondition failed'), { code: 412 }));

    const response = await postHold({ file: file.file });
    expect(response.status).toBe(409);
    expect(holdMocks.confirmVerificationDeletionHold).not.toHaveBeenCalled();
  });

  it('fails closed on GCS errors other than 412 and never confirms', async () => {
    const file = makeFile({
      generation: '773',
      metageneration: '11',
      temporaryHold: false,
    });
    file.setMetadata.mockRejectedValue(Object.assign(new Error('storage unavailable'), { code: 503 }));

    const response = await postHold({ file: file.file });
    expect(response.status).toBe(503);
    expect(holdMocks.confirmVerificationDeletionHold).not.toHaveBeenCalled();
  });

  it('reconciles an already active GCS temporary hold without repeating metadata mutation', async () => {
    const file = makeFile({
      generation: '773',
      metageneration: '12',
      temporaryHold: true,
    });

    const response = await postHold({ file: file.file });
    expect(response.status).toBe(200);
    expect(file.setMetadata).not.toHaveBeenCalled();
    expect(holdMocks.confirmVerificationDeletionHold).toHaveBeenCalledTimes(1);
  });

  it('rejects actor spoofing and does not begin a hold', async () => {
    const file = makeFile({
      generation: '773',
      metageneration: '11',
      temporaryHold: false,
    });

    const response = await postHold({
      file: file.file,
      body: {
        objectKey: OBJECT_KEY,
        holdField: 'moderationHoldActive',
        actor: 'someone-else',
        requestId: REQUEST_ID,
      },
    });
    expect(response.status).toBe(400);
    expect(holdMocks.beginVerificationDeletionHold).not.toHaveBeenCalled();
  });

  it('does not expose account-erasure state through the manual administrator route', async () => {
    const file = makeFile({
      generation: '773',
      metageneration: '11',
      temporaryHold: false,
    });
    const response = await postHold({
      file: file.file,
      role: 'super_admin',
      body: {
        objectKey: OBJECT_KEY,
        holdField: 'accountErasureActive',
        requestId: REQUEST_ID,
      },
    });
    expect(response.status).toBe(403);
    expect(holdMocks.beginVerificationDeletionHold).not.toHaveBeenCalled();
  });
});

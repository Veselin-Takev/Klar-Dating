// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  assessSafetyMessage: vi.fn(),
  runTransaction: vi.fn(),
  appendAuditLog: vi.fn(async () => ({ id: 'audit' })),
}));

vi.mock('../src/server/safetyService', () => ({ assessSafetyMessage: mocks.assessSafetyMessage }));
vi.mock('../src/server/db', () => ({
  FieldValue: { serverTimestamp: () => 'server-time' },
  getDb: () => ({
    runTransaction: mocks.runTransaction,
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ id: 'message-id' }) }) }) }),
  }),
}));
vi.mock('../src/server/platform/launchPlatform', () => ({ recordActivation: vi.fn(async () => {}) }));
vi.mock('../src/server/platform/auditLog', () => ({ appendAuditLog: mocks.appendAuditLog }));
vi.mock('../src/server/chatAccess', () => ({
  ChatAccessError: class ChatAccessError extends Error { constructor(public status:number, public code:string, message:string){ super(message); } },
  validDocumentId: (v: unknown) => typeof v === 'string' && !!v,
  readChatAccess: vi.fn(async () => ({ recipientId: 'user-2', data: {}, ref: {} })),
}));
vi.mock('../src/server/authorization', () => ({ currentUserId: () => 'user-1' }));

import { handleSendMessage } from '../src/server/messages';

async function invoke(text='hello') {
  let status=200; let payload:any;
  const req={ body:{ chatId:'chat-1', text, clientMessageId:'id-1' }, user:{ uid:'user-1' } } as unknown as Request;
  const res={ status(code:number){status=code;return this;}, json(value:unknown){payload=value;return this;} } as unknown as Response;
  await handleSendMessage(req,res);
  return {status,payload};
}

describe('authoritative chat safety enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ get: async () => ({ exists: false }) }));
  });

  it('blocks a flagged message before the persistence transaction', async () => {
    mocks.assessSafetyMessage.mockResolvedValue({ checked:true, flagged:true, explanation:'Red flag', suggestions:['Stop'] });
    const result=await invoke('unsafe');
    expect(result).toMatchObject({status:422,payload:{code:'message_flagged'}});
    // One transaction is the pre-AI authorization check; no write transaction follows.
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(expect.anything(), { type: 'safety_message_blocked', actorUid: 'user-1' });
  });

  it('fails closed when safety assessment is unavailable', async () => {
    mocks.assessSafetyMessage.mockResolvedValue({ checked:false, status:503, code:'safety_unavailable' });
    const result=await invoke();
    expect(result).toMatchObject({status:503,payload:{code:'safety_unavailable'}});
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
  });
});

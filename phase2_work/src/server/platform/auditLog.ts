import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '../db';
import { z } from 'zod';

const AUDIT_TYPE = /^[a-z][a-z0-9_.-]{2,79}$/;
const scalar = z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]);
const metadataSchema = z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/), scalar).default({});

const auditEventSchema = z.object({
  schemaVersion: z.literal(1),
  type: z.string().regex(AUDIT_TYPE),
  actorPseudonym: z.string().regex(/^[a-f0-9]{64}$/),
  timestamp: z.unknown(),
  metadata: metadataSchema,
}).strict();

function auditSecret(): string {
  const secret = process.env.AUDIT_LOG_SECRET_KEY ?? process.env.CONSENT_AUDIT_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUDIT_LOG_SECRET_KEY is required for pseudonymous audit logging');
  return secret;
}

export function pseudonymizeAuditSubject(uid: string): string {
  return crypto.createHmac('sha256', auditSecret()).update(uid, 'utf8').digest('hex');
}

/**
 * Append-only operational audit writer. It never exposes a raw UID and never
 * updates an existing audit document. Art. 17 erasure remains a separate,
 * explicit privacy operation for legacy records containing direct identifiers.
 */
export async function appendAuditLog(
  firestore: Firestore,
  input: { type: string; actorUid: string; metadata?: Record<string, string | number | boolean | null> },
): Promise<string> {
  const payload = auditEventSchema.parse({
    schemaVersion: 1,
    type: input.type,
    actorPseudonym: pseudonymizeAuditSubject(input.actorUid),
    timestamp: FieldValue.serverTimestamp(),
    metadata: input.metadata ?? {},
  });
  const ref = firestore.collection('audit_logs').doc();
  await ref.create(payload);
  return ref.id;
}

import crypto from "node:crypto";

export type ConsentAuditAction = "granted" | "withdrawn";

export interface ConsentAuditPayload {
  actorUid: string;
  action: ConsentAuditAction;
  legalVersion: number;
  purposes: Record<string, boolean>;
  effectiveAt: string | null;
  recordedAt: string;
  withdrawnPurpose?: string;
  previousEvidenceId?: string | null;
  source: "authenticated-api";
}

export interface SignedConsentAuditRecord extends ConsentAuditPayload {
  signatureAlgorithm: "HMAC-SHA256";
  signature: string;
}

export function canonicalizeAuditPayload(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeAuditPayload).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeAuditPayload(entry)}`)
    .join(",")}}`;
}


/** Shared canonical HMAC-SHA256 envelope for consent and adjacent privacy ledgers. */
export function signHmacAuditPayload<T extends Record<string, unknown>>(
  payload: T,
  secret: string,
): T & { signatureAlgorithm: 'HMAC-SHA256'; signature: string } {
  if (secret.length < 32) throw new Error('Audit HMAC secret must contain at least 32 characters');
  const signature = crypto.createHmac('sha256', secret).update(canonicalizeAuditPayload(payload), 'utf8').digest('hex');
  return { ...payload, signatureAlgorithm: 'HMAC-SHA256', signature };
}

export function verifyHmacAuditPayload(
  record: Record<string, unknown> & { signatureAlgorithm?: unknown; signature?: unknown },
  secret: string,
): boolean {
  try {
    if (record.signatureAlgorithm !== 'HMAC-SHA256' || typeof record.signature !== 'string' || !/^[a-f0-9]{64}$/.test(record.signature)) return false;
    const { signature, signatureAlgorithm, ...payload } = record;
    const expected = signHmacAuditPayload(payload, secret).signature;
    const actualBytes = Buffer.from(signature, 'hex');
    const expectedBytes = Buffer.from(expected, 'hex');
    return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
  } catch { return false; }
}

export function signConsentAuditRecord(
  payload: ConsentAuditPayload,
  secret: string,
): SignedConsentAuditRecord {
  if (secret.length < 32) {
    throw new Error("CONSENT_AUDIT_SECRET must contain at least 32 characters");
  }
  return signHmacAuditPayload(payload as unknown as Record<string, unknown>, secret) as SignedConsentAuditRecord;
}

export function verifyConsentAuditRecord(
  record: SignedConsentAuditRecord,
  secret: string,
): boolean {
  try {
    return verifyHmacAuditPayload(record as unknown as Record<string, unknown> & { signatureAlgorithm?: unknown; signature?: unknown }, secret);
  } catch {
    return false;
  }
}

export function consentAuditSecret(): string {
  const secret =
    process.env.CONSENT_AUDIT_SECRET ?? process.env.AUDIT_LOG_SECRET_KEY;
  if (secret) {
    if (secret.length < 32) {
      throw new Error("CONSENT_AUDIT_SECRET must contain at least 32 characters");
    }
    return secret;
  }
  throw new Error("CONSENT_AUDIT_SECRET is not configured; refusing to sign consent audit records without an explicit production secret");
}

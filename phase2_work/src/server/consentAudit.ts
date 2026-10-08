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

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
    .join(",")}}`;
}

export function signConsentAuditRecord(
  payload: ConsentAuditPayload,
  secret: string,
): SignedConsentAuditRecord {
  if (secret.length < 32) {
    throw new Error("CONSENT_AUDIT_SECRET must contain at least 32 characters");
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(stable(payload), "utf8")
    .digest("hex");

  return {
    ...payload,
    signatureAlgorithm: "HMAC-SHA256",
    signature,
  };
}

export function verifyConsentAuditRecord(
  record: SignedConsentAuditRecord,
  secret: string,
): boolean {
  try {
    const { signature, signatureAlgorithm, ...payload } = record;
    if (
      signatureAlgorithm !== "HMAC-SHA256" ||
      typeof signature !== "string" ||
      !/^[a-f0-9]{64}$/.test(signature)
    ) return false;
    const expected = signConsentAuditRecord(payload, secret).signature;
    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return (
      actualBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    );
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

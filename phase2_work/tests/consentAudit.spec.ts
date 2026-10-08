import { describe, expect, it } from "vitest";
import {
  signConsentAuditRecord,
  verifyConsentAuditRecord,
  type ConsentAuditPayload,
} from "../src/server/consentAudit";

const secret = "enterprise-test-secret-at-least-32-characters";

const payload: ConsentAuditPayload = {
  actorUid: "user-123",
  action: "granted",
  legalVersion: 1,
  purposes: {
    notwendig: true,
    ki_auswertung: false,
    fehlerberichte: true,
  },
  effectiveAt: "2026-09-21T06:00:00.000Z",
  recordedAt: "2026-09-21T06:00:00.000Z",
  source: "authenticated-api",
};

describe("tamper-evident consent records", () => {
  it("signs and verifies an unchanged record", () => {
    const signed = signConsentAuditRecord(payload, secret);
    expect(signed.signatureAlgorithm).toBe("HMAC-SHA256");
    expect(signed.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyConsentAuditRecord(signed, secret)).toBe(true);
  });

  it("detects changed purposes, actors, timestamps, and actions", () => {
    const signed = signConsentAuditRecord(payload, secret);

    for (const changed of [
      { ...signed, actorUid: "user-999" },
      { ...signed, action: "withdrawn" as const },
      { ...signed, recordedAt: "2026-09-21T07:00:00.000Z" },
      { ...signed, purposes: { ...signed.purposes, ki_auswertung: true } },
    ]) {
      expect(verifyConsentAuditRecord(changed, secret)).toBe(false);
    }
  });

  it("rejects appended garbage and unsupported signature algorithms", () => {
    const signed = signConsentAuditRecord(payload, secret);
    for (const signature of [signed.signature + "zz", signed.signature + "00", signed.signature.slice(1)]) {
      expect(verifyConsentAuditRecord({ ...signed, signature }, secret)).toBe(false);
    }
    expect(verifyConsentAuditRecord({
      ...signed,
      signatureAlgorithm: "SHA256" as typeof signed.signatureAlgorithm,
    }, secret)).toBe(false);
    expect(verifyConsentAuditRecord(signed, secret + "-wrong")).toBe(false);
  });

  it("rejects short secrets and malformed signatures", () => {
    expect(() => signConsentAuditRecord(payload, "short")).toThrow(
      /at least 32 characters/,
    );

    const signed = signConsentAuditRecord(payload, secret);
    expect(
      verifyConsentAuditRecord({ ...signed, signature: "not-hex" }, secret),
    ).toBe(false);
  });
});

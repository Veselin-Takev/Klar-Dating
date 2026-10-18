import { describe, expect, it } from 'vitest';
import {
  PartnerConversionPayloadSchema,
  derivePartnerReferralToken,
  isAutomatedPartnerClick,
  partnerBuyerClaimDocumentId,
  partnerReferralDocumentId,
  partnerWebhookEventDocumentId,
  partnerWebhookSignature,
  pseudonymousPartnerUid,
  validatePartnerDestinationUrl,
  verifyPartnerWebhookSignature,
} from '../src/server/partnerReferralCore';

const tokenSecret = 'test-partner-token-secret-with-more-than-32-chars';
const webhookSecret = 'test-partner-webhook-secret-with-more-than-32-chars';
const auditSecret = 'test-partner-audit-secret-with-more-than-32-chars';
const payload = {
  event: 'qualified_conversion' as const,
  eventId: 'event-2026-10-09-0001',
  referralToken: 'a'.repeat(64),
  buyerUid: 'klarUser_123',
};

describe('Klar & Partner security core', () => {
  it('derives deterministic UID-, campaign- and version-scoped tokens', () => {
    const first = derivePartnerReferralToken('uid-a', 'campaign-a', 1, tokenSecret);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(derivePartnerReferralToken('uid-a', 'campaign-a', 1, tokenSecret)).toBe(first);
    expect(derivePartnerReferralToken('uid-b', 'campaign-a', 1, tokenSecret)).not.toBe(first);
    expect(derivePartnerReferralToken('uid-a', 'campaign-b', 1, tokenSecret)).not.toBe(first);
    expect(derivePartnerReferralToken('uid-a', 'campaign-a', 2, tokenSecret)).not.toBe(first);
    expect(partnerReferralDocumentId(first)).not.toBe(first);
    expect(() => derivePartnerReferralToken('uid-a', 'campaign-a', 1, 'short')).toThrow();
  });

  it('uses keyed pseudonyms, not plain hashes of UIDs', () => {
    const ref = pseudonymousPartnerUid('uid-sensitive', auditSecret);
    expect(ref).toMatch(/^[a-f0-9]{64}$/);
    expect(ref).not.toContain('uid-sensitive');
    expect(pseudonymousPartnerUid('uid-sensitive', auditSecret)).toBe(ref);
    expect(pseudonymousPartnerUid('uid-sensitive', tokenSecret)).not.toBe(ref);
    expect(() => pseudonymousPartnerUid('uid-sensitive', 'short')).toThrow();
  });

  it('allows only public HTTPS destinations', () => {
    expect(validatePartnerDestinationUrl('https://www.hellofresh.com/offer')).toBe('https://www.hellofresh.com/offer');
    expect(validatePartnerDestinationUrl('https://www.hellofresh.com/offer?campaign=fall&channel=partner'))
      .toContain('campaign=fall');
    // Reserved attribution parameters must not survive a consentless direct redirect.
    for (const destination of [
      'https://partner.example/offer?klar_referral=secret',
      'https://partner.example/offer?KLAR_REFERRAL=secret',
      'https://partner.example/offer?%6Blar_referral=secret',
      'https://partner.example/offer?campaign=fall&klar_referral=secret',
    ]) {
      expect(() => validatePartnerDestinationUrl(destination)).toThrowError(
        expect.objectContaining({ code: 'unsafe_destination' }),
      );
    }
    for (const unsafe of [
      'javascript:alert(1)',
      'http://www.hellofresh.com/',
      'https://localhost/admin',
      'https://127.0.0.1/private',
      'https://metadata.google.internal/latest',
      'https://partner.local/private',
      'https://user:pass@partner.example.com/',
    ]) expect(() => validatePartnerDestinationUrl(unsafe)).toThrow();
  });

  it('suppresses crawlers, prefetches and non-GET click probes', () => {
    expect(isAutomatedPartnerClick({ userAgent: 'Mozilla/5.0 Chrome/153.0', method: 'GET' })).toBe(false);
    expect(isAutomatedPartnerClick({ userAgent: 'WhatsApp/2.0 link preview', method: 'GET' })).toBe(true);
    expect(isAutomatedPartnerClick({ userAgent: 'Mozilla/5.0 Chrome/153.0', method: 'GET', secPurpose: 'prefetch' })).toBe(true);
    expect(isAutomatedPartnerClick({ userAgent: 'Mozilla/5.0 Chrome/153.0', method: 'POST' })).toBe(true);
    expect(isAutomatedPartnerClick({ method: 'GET' })).toBe(true);
  });

  it('authenticates provider callbacks and rejects stale/tampered payloads', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = partnerWebhookSignature(payload, timestamp, webhookSecret);
    expect(verifyPartnerWebhookSignature(payload, timestamp, signature, webhookSecret)).toBe(true);
    expect(verifyPartnerWebhookSignature({ ...payload, buyerUid: 'attacker' }, timestamp, signature, webhookSecret)).toBe(false);
    expect(verifyPartnerWebhookSignature(payload, timestamp, signature, 'wrong-secret-with-length-more-than-32')).toBe(false);
    expect(verifyPartnerWebhookSignature(payload, String(Number(timestamp) - 301), signature, webhookSecret)).toBe(false);
    expect(verifyPartnerWebhookSignature(payload, timestamp, 'sha256=deadbeef', webhookSecret)).toBe(false);
  });

  it('uses HMAC-derived event and per-campaign buyer claim identifiers', () => {
    const event = partnerWebhookEventDocumentId('hello-fresh', payload.eventId, webhookSecret);
    expect(event).toMatch(/^[a-f0-9]{64}$/);
    expect(event).toBe(partnerWebhookEventDocumentId('hello-fresh', payload.eventId, webhookSecret));
    expect(event).not.toBe(partnerWebhookEventDocumentId('hello-fresh', payload.eventId + '-different', webhookSecret));
    const buyer = partnerBuyerClaimDocumentId('hello-fresh', payload.buyerUid, webhookSecret);
    expect(buyer).not.toContain(payload.buyerUid);
    expect(buyer).not.toBe(partnerBuyerClaimDocumentId('revolut', payload.buyerUid, webhookSecret));
  });

  it('validates conversion envelope strictly and rejects provider PII fields', () => {
    expect(PartnerConversionPayloadSchema.safeParse(payload).success).toBe(true);
    expect(PartnerConversionPayloadSchema.safeParse({ ...payload, buyerEmail: 'sensitive@example.test' }).success).toBe(false);
    expect(PartnerConversionPayloadSchema.safeParse({ ...payload, eventId: 'x' }).success).toBe(false);
  });
});

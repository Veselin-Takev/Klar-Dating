import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { canonicalizeAuditPayload } from './consentAudit';

export const PartnerCampaignStatusSchema = z.enum(['draft', 'active', 'inactive', 'deleted']);
export const PartnerCampaignInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/),
  destinationUrl: z.string().trim().url().max(2048),
  rewardLabel: z.string().trim().min(2).max(160),
  termsSummary: z.string().trim().min(8).max(2000),
  brandVerified: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
}).strict();
export const PartnerCampaignPatchSchema = PartnerCampaignInputSchema.partial().strict();
export const PartnerConversionPayloadSchema = z.object({
  event: z.literal('qualified_conversion'),
  eventId: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  referralToken: z.string().regex(/^[a-f0-9]{64}$/),
  // Klar UID is used transiently to enforce age/consent and reject self-referrals.
  // It is never stored in partner conversion or ledger documents.
  buyerUid: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export type PartnerCampaignInput = z.infer<typeof PartnerCampaignInputSchema>;
export type PartnerCampaignPatch = z.infer<typeof PartnerCampaignPatchSchema>;
export type PartnerConversionPayload = z.infer<typeof PartnerConversionPayloadSchema>;

export class PartnerReferralError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'PartnerReferralError';
  }
}

/** Only public HTTPS destinations are permitted; campaign redirects are never arbitrary schemes. */
export function validatePartnerDestinationUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new PartnerReferralError(400, 'invalid_destination', 'Die Partner-URL ist ungültig.');
  }
  let url: URL;
  try { url = new URL(value); } catch {
    throw new PartnerReferralError(400, 'invalid_destination', 'Die Partner-URL ist ungültig.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.')
    || isIP(host) !== 0 || host === 'localhost' || host.endsWith('.localhost')
    || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')
    || host === 'metadata.google.internal' || host === 'host.docker.internal') {
    throw new PartnerReferralError(400, 'unsafe_destination', 'Partnerlinks müssen auf eine öffentliche HTTPS-Domain zeigen.');
  }
  return url.toString();
}

export function parsePartnerCampaignInput(value: unknown, patch = false): PartnerCampaignInput | PartnerCampaignPatch {
  const result = patch ? PartnerCampaignPatchSchema.safeParse(value) : PartnerCampaignInputSchema.safeParse(value);
  if (!result.success) throw new PartnerReferralError(400, 'invalid_campaign', 'Die Kampagnendaten sind unvollständig oder ungültig.');
  const candidate = result.data as PartnerCampaignInput | PartnerCampaignPatch;
  if (candidate.destinationUrl !== undefined) {
    return { ...candidate, destinationUrl: validatePartnerDestinationUrl(candidate.destinationUrl) };
  }
  return candidate;
}

export function derivePartnerReferralToken(uid: string, campaignId: string, version: number, secret: string): string {
  if (secret.length < 32) throw new PartnerReferralError(503, 'partner_signing_unavailable', 'Partnerlinks sind derzeit nicht verfügbar.');
  if (!uid || !campaignId || !Number.isSafeInteger(version) || version < 1) {
    throw new PartnerReferralError(400, 'invalid_referral_identity', 'Die Partner-Empfehlung ist ungültig.');
  }
  return crypto.createHmac('sha256', secret)
    .update('klar-partner-referral:v1:' + uid + ':' + campaignId + ':' + version, 'utf8')
    .digest('hex');
}

export function partnerReferralDocumentId(token: string): string {
  return crypto.createHash('sha256').update('klar-partner-referral-document:v1:' + token, 'utf8').digest('hex');
}

/** Domain-separated, non-reversible UID reference used for Art. 17 cleanup and audit correlation. */
export function pseudonymousPartnerUid(uid: string, secret: string): string {
  if (secret.length < 32) throw new PartnerReferralError(503, 'partner_ledger_unavailable', 'Das Partner-Ledger ist derzeit nicht verfügbar.');
  return crypto.createHmac('sha256', secret).update('klar-partner-uid:v1:' + uid, 'utf8').digest('hex');
}

export function partnerWebhookEventDocumentId(slug: string, eventId: string, secret: string): string {
  if (secret.length < 32) throw new PartnerReferralError(503, 'partner_webhook_unconfigured', 'Der Partner-Rückkanal ist nicht konfiguriert.');
  return crypto.createHmac('sha256', secret).update('klar-partner-event:v1:' + slug + ':' + eventId, 'utf8').digest('hex');
}

export function partnerBuyerClaimDocumentId(slug: string, buyerUid: string, secret: string): string {
  if (secret.length < 32) throw new PartnerReferralError(503, 'partner_webhook_unconfigured', 'Der Partner-Rückkanal ist nicht konfiguriert.');
  return crypto.createHmac('sha256', secret).update('klar-partner-buyer:v1:' + slug + ':' + buyerUid, 'utf8').digest('hex');
}

export function isAutomatedPartnerClick(input: {
  userAgent?: string | null;
  purpose?: string | null;
  secPurpose?: string | null;
  method?: string | null;
}): boolean {
  const userAgent = (input.userAgent ?? '').toLowerCase();
  const purpose = (input.purpose ?? '').toLowerCase();
  const secPurpose = (input.secPurpose ?? '').toLowerCase();
  if (!userAgent || input.method !== 'GET') return true;
  if (/\b(bot|crawler|spider|preview|prefetch|slackbot|discordbot|telegrambot|whatsapp|facebookexternalhit|twitterbot|linkedinbot|headlesschrome|lighthouse|curl\/|wget\/|python-requests|uptime|monitoring)\b/.test(userAgent)) return true;
  return purpose.includes('prefetch') || secPurpose.includes('prefetch') || secPurpose.includes('prerender');
}

export function partnerWebhookSignature(payload: PartnerConversionPayload, timestamp: string, secret: string): string {
  if (secret.length < 32) throw new PartnerReferralError(503, 'partner_webhook_unconfigured', 'Der Partner-Rückkanal ist nicht konfiguriert.');
  const canonical = canonicalizeAuditPayload(payload);
  return 'sha256=' + crypto.createHmac('sha256', secret)
    .update('klar-partner-webhook:v1\n' + timestamp + '\n' + canonical, 'utf8')
    .digest('hex');
}

export function verifyPartnerWebhookSignature(
  payload: PartnerConversionPayload,
  timestamp: string,
  supplied: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (secret.length < 32 || !/^\d{10}$/.test(timestamp) || !Number.isSafeInteger(nowSeconds)) return false;
  const parsedTime = Number(timestamp);
  if (!Number.isSafeInteger(parsedTime) || Math.abs(nowSeconds - parsedTime) > 300) return false;
  const expected = partnerWebhookSignature(payload, timestamp, secret);
  if (!/^sha256=[a-f0-9]{64}$/.test(supplied)) return false;
  const expectedBytes = Buffer.from(expected, 'utf8');
  const suppliedBytes = Buffer.from(supplied, 'utf8');
  return expectedBytes.length === suppliedBytes.length && crypto.timingSafeEqual(expectedBytes, suppliedBytes);
}

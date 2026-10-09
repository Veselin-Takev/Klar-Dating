import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { compatibilityScore } from '../../src/server/platform/compatibility';
import { assessRisk, evaluateAccountRisk } from '../../src/server/platform/riskEngine';
import { sanitizePromptInput } from '../../src/server/platform/privacySanitizer';

test('compatibility rewards aligned goals and values', () => {
  const score = compatibilityScore({ values: ['family','honesty'], relationshipGoals:['long-term'], interests:['hiking'] }, { values:['honesty','family'], relationshipGoals:['long-term'], interests:['hiking'] });
  assert.ok(score >= 90);
});

test('risk engine escalates scam-like signals', () => {
  const result = assessRisk({ accountAgeDays: 1, reportCount: 2, outboundMessages24h: 150, repeatedMessageRatio: .8, externalPaymentMentions: 2 });
  assert.equal(result.level, 'high');
  assert.ok(result.actions.includes('safety_review'));
});

test('evaluateAccountRisk escalates and writes flag for high-risk accounts', async () => {
  let writtenData: any = null;
  const mockDb = {
    collection: (colName: string) => {
      if (colName === 'reports') {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({ size: 3 })
            })
          })
        };
      }
      if (colName === 'blocks') {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({ size: 5 })
            })
          })
        };
      }
      if (colName === 'users') {
        return {
          doc: (_uid: string) => ({
            get: async () => ({
              data: () => ({
                createdAt: { toDate: () => new Date(Date.now() - 1000 * 3600 * 24) } // 1 day old
              })
            }),
            set: async (data: any) => {
              writtenData = data;
            }
          })
        };
      }
      throw new Error(`Unexpected collection ${colName}`);
    }
  };

  const decision = await evaluateAccountRisk(mockDb as unknown as Firestore, 'bad-actor-1', {
    outboundMessages24h: 120,
    externalPaymentMentions: 2
  });

  assert.equal(decision.level, 'high');
  assert.ok(writtenData);
  assert.equal(writtenData.riskLevel, 'high');
  assert.equal(writtenData.requiresSafetyReview, true);
  assert.ok(writtenData.riskActions.includes('safety_review'));
});

test('evaluateAccountRisk keeps benign accounts clean without update', async () => {
  let writtenData: any = null;
  const mockDb = {
    collection: (colName: string) => {
      if (colName === 'reports' || colName === 'blocks') {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({ size: 0 })
            })
          })
        };
      }
      if (colName === 'users') {
        return {
          doc: (_uid: string) => ({
            get: async () => ({
              data: () => ({
                createdAt: { toDate: () => new Date(Date.now() - 1000 * 3600 * 24 * 100) } // 100 days old
              })
            }),
            set: async (data: any) => {
              writtenData = data;
            }
          })
        };
      }
      throw new Error(`Unexpected collection ${colName}`);
    }
  };

  const decision = await evaluateAccountRisk(mockDb as unknown as Firestore, 'good-user-1', {});
  assert.equal(decision.level, 'low');
  assert.equal(writtenData, null);
});

test('evaluateAccountRisk escalates on multiple blocks and message velocity', async () => {
  let writtenData: any = null;
  const mockDb = {
    collection: (colName: string) => {
      if (colName === 'reports') {
        return { where: () => ({ limit: () => ({ get: async () => ({ size: 2 }) }) }) };
      }
      if (colName === 'blocks') {
        return { where: () => ({ limit: () => ({ get: async () => ({ size: 5 }) }) }) };
      }
      if (colName === 'users') {
        return {
          doc: (_uid: string) => ({
            get: async () => ({
              data: () => ({ createdAt: { toDate: () => new Date(Date.now() - 1000 * 3600 * 24 * 2) } })
            }),
            set: async (data: any) => { writtenData = data; }
          })
        };
      }
      throw new Error(`Unexpected collection ${colName}`);
    }
  };

  const decision = await evaluateAccountRisk(mockDb as unknown as Firestore, 'blocked-user-1', { repeatedMessageRatio: 0.9, outboundMessages24h: 110 });
  assert.equal(decision.level, 'high');
  assert.ok(writtenData);
  assert.equal(writtenData.requiresSafetyReview, true);
});

test('privacySanitizer redacts Art. 9 health and medical data from prompts', () => {
  const input = "Ich suche jemanden mit Empathie. Ich hatte früher mit Depression zu kämpfen und mache Therapie.";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, false);
  assert.ok(res.redactedTypes.includes('art9_health'));
  assert.ok(!res.sanitized.toLowerCase().includes('depression'));
  assert.ok(!res.sanitized.toLowerCase().includes('therapie'));
  assert.ok(res.sanitized.includes('[REDACTED_ART9]'));
});

test('privacySanitizer redacts Art. 9 religious and political affiliation markers from prompts', () => {
  const input = "Glaube ist mir wichtig, ich bin gläubiger Moslem und engagiere mich bei den Grünen.";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, false);
  assert.ok(res.redactedTypes.includes('art9_religion_politics'));
  assert.ok(!res.sanitized.toLowerCase().includes('moslem'));
  assert.ok(!res.sanitized.toLowerCase().includes('grünen'));
  assert.ok(res.sanitized.includes('[REDACTED_ART9]'));
});

test('privacySanitizer redacts financial identifiers (IBAN) and off-platform contact details', () => {
  const input = "Schreib mir auf Telegram: @lisa_love oder WhatsApp +49 170 12345678, oder sende per PayPal: @lisa_pay meine IBAN ist DE89370400440532013000";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, false);
  assert.ok(res.redactedTypes.includes('contact_info'));
  assert.ok(res.redactedTypes.includes('financial'));
  assert.ok(!res.sanitized.includes('DE89370400440532013000'));
  assert.ok(!res.sanitized.includes('+49 170 12345678'));
  assert.ok(res.sanitized.includes('[REDACTED_FINANCIAL]'));
  assert.ok(res.sanitized.includes('[REDACTED_CONTACT]'));
});

test('privacySanitizer leaves clean dating intent prompts unchanged', () => {
  const input = "Hi, ich gehe gerne wandern, koche leidenschaftlich Pasta und suche eine langfristige Beziehung auf Augenhöhe.";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, true);
  assert.equal(res.redactedTypes.length, 0);
  assert.equal(res.sanitized, input);
});


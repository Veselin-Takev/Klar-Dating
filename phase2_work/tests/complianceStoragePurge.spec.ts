// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { complianceSignature, validComplianceRequest } from '../src/server/routes/complianceStorage';

describe('verification storage compliance job authentication', () => {
  const secret = 'x'.repeat(64);
  const timestamp = String(Date.now());
  const body = Buffer.from('{}');

  it('accepts only a fresh HMAC proof', () => {
    const signature = complianceSignature(`${timestamp}.${body.toString('utf8')}`, secret);
    expect(validComplianceRequest(body, timestamp, signature, secret, Number(timestamp))).toBe(true);
  });

  it('authenticates the original binary octets instead of lossy UTF-8 text', () => {
    const bytes = Buffer.from([0xff, 0xfe, 0x7b, 0x7d]);
    const proof = createHmac('sha256', secret).update(timestamp + '.').update(bytes).digest('hex');
    expect(validComplianceRequest(bytes, timestamp, proof, secret, Number(timestamp))).toBe(true);
    expect(validComplianceRequest(Buffer.from(bytes.toString('utf8'), 'utf8'), timestamp, proof, secret, Number(timestamp))).toBe(false);
  });

  it('rejects replay, wrong secret and malformed signatures', () => {
    const signature = complianceSignature(`${timestamp}.{} `, secret);
    expect(validComplianceRequest(body, timestamp, signature, secret, Number(timestamp))).toBe(false);
    const valid = complianceSignature(`${timestamp}.${body.toString('utf8')}`, secret);
    expect(validComplianceRequest(body, timestamp, valid, 'short', Number(timestamp))).toBe(false);
    expect(validComplianceRequest(body, String(Number(timestamp) - 301_000), valid, secret, Number(timestamp))).toBe(false);
  });
});

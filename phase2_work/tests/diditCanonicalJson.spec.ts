import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalizeDiditJsonText, DiditCanonicalJsonError } from '../src/server/verification/diditCanonicalJson';
import { verifyDiditSignatureText } from '../src/server/verification/diditKyc';

describe('Didit V3 canonical JSON', () => {
  it('sorts keys by Unicode code point and preserves exact integer lexemes', () => {
    const raw = '{"🙂":2,"2":"b","Ａ":1,"10":"a","large":1000000000000000129}';
    expect(canonicalizeDiditJsonText(raw))
      .toBe('{"10":"a","2":"b","large":1000000000000000129,"Ａ":1,"🙂":2}');
  });

  it('normalizes whole floats and Python-style scientific exponents', () => {
    expect(canonicalizeDiditJsonText('{"whole":27.0,"tiny":0.00001,"decimal":0.0001,"scaled":1.2300e2}'))
      .toBe('{"decimal":0.0001,"scaled":123,"tiny":1e-05,"whole":27}');
  });

  it('rejects duplicate keys and malformed JSON instead of guessing a signature payload', () => {
    expect(() => canonicalizeDiditJsonText('{"a":1,"a":2}')).toThrow(DiditCanonicalJsonError);
    expect(() => canonicalizeDiditJsonText('{"a":1,}')).toThrow(DiditCanonicalJsonError);
  });
});

describe('Didit V3 X-Signature-V2 verification', () => {
  const secret = 'didit-webhook-secret-that-is-long-enough';
  const now = 1_800_000_000_000;
  const timestamp = String(Math.floor(now / 1000));
  const raw = '{"vendor_data":"user-1","timestamp":1800000000,"metadata":{"10":2,"2":1},"score":27.0}';
  const signature = createHmac('sha256', secret).update(canonicalizeDiditJsonText(raw), 'utf8').digest('hex');

  it('accepts the exact canonical payload and matching signed timestamp', () => {
    expect(verifyDiditSignatureText(raw, signature, timestamp, secret, now)).toBe(true);
  });

  it('fails closed on payload tampering, stale delivery or mismatched timestamp header', () => {
    expect(verifyDiditSignatureText(raw.replace('"user-1"', '"user-2"'), signature, timestamp, secret, now)).toBe(false);
    expect(verifyDiditSignatureText(raw, signature, timestamp, secret, now + 301_000)).toBe(false);
    expect(verifyDiditSignatureText(raw, signature, String(Number(timestamp) + 1), secret, now)).toBe(false);
  });
});

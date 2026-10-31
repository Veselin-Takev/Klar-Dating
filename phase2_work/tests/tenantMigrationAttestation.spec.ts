// @vitest-environment node
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  INVENTORY_SIGNATURE_DOMAIN, MAPPING_SIGNATURE_DOMAIN,
  preflightSignedLegacyProfileMapping,
} from '../src/server/multitenant/tenantMigrationAttestation';

const snap = '00000000-0000-4000-8000-000000000001';
const sha = 'a'.repeat(64);
const evidence = 'b'.repeat(64);
const record = {
  sourcePath: 'users/user_1', ownerUid: 'user_1',
  sourceSha256: sha, deletionState: 'none',
};
const assignment = {
  sourcePath: 'users/user_1', ownerUid: 'user_1', sourceSha256: sha,
  tenantId: 'tenant-one', mappingEvidenceSha256: evidence,
};
function createFixture() {
  const inventoryBytes = Buffer.from(JSON.stringify({
    schemaVersion: 1, snapshotId: snap, records: [record],
  }));
  const mappingBytes = Buffer.from(JSON.stringify({
    schemaVersion: 1, snapshotId: snap, assignments: [assignment],
  }));
  const exporter = generateKeyPairSync('ed25519');
  const approver = generateKeyPairSync('ed25519');
  const trustAnchorBytes = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    exporterPublicKeyPem: exporter.publicKey.export({ format: 'pem', type: 'spki' }),
    approverPublicKeyPem: approver.publicKey.export({ format: 'pem', type: 'spki' }),
  }));
  const expectedTrustAnchorSha256 = createHash('sha256').update(trustAnchorBytes).digest('hex');
  const signatureEnvelope = {
    schemaVersion: 1,
    inventorySignature: sign(null, Buffer.concat([
      Buffer.from(INVENTORY_SIGNATURE_DOMAIN), inventoryBytes,
    ]), exporter.privateKey).toString('base64url'),
    mappingSignature: sign(null, Buffer.concat([
      Buffer.from(MAPPING_SIGNATURE_DOMAIN), mappingBytes,
    ]), approver.privateKey).toString('base64url'),
  };
  return { inventoryBytes, mappingBytes, trustAnchorBytes, expectedTrustAnchorSha256,
    signatureEnvelope, exporter, approver };
}
describe('separated Ed25519 tenant migration attestation (never GO)', () => {
  it('verifies both roles and returns a minimal, permanently blocked report', () => {
    const f = createFixture();
    const result = preflightSignedLegacyProfileMapping(f);
    expect(result).toMatchObject({
      status: 'BLOCKED_MANUAL_APPROVAL_REQUIRED',
      profileCount: 1, tenantCount: 1,
      attestation: 'CRYPTOGRAPHIC_SIGNATURES_VERIFIED_NOT_APPROVAL',
    });
    expect(JSON.stringify(result)).not.toContain('user_1');
    expect(JSON.stringify(result)).not.toContain(f.signatureEnvelope.inventorySignature);
    expect(preflightSignedLegacyProfileMapping(f)).toEqual(result);
  });
  it('denies modified profile bytes, mapping bytes, or signatures', () => {
    for (const field of ['inventoryBytes', 'mappingBytes'] as const) {
      const f = createFixture();
      const altered = Buffer.from(f[field]);
      altered[altered.length - 2] = altered[altered.length - 2] === 97 ? 98 : 97;
      expect(() => preflightSignedLegacyProfileMapping({ ...f, [field]: altered })).toThrow();
    }
    for (const field of ['inventorySignature', 'mappingSignature'] as const) {
      const f = createFixture();
      const altered = { ...f.signatureEnvelope, [field]: 'A'.repeat(86) };
      expect(() => preflightSignedLegacyProfileMapping({ ...f, signatureEnvelope: altered })).toThrow();
    }
  });
  it('rejects swapped signature roles and domain confusion', () => {
    const f = createFixture();
    const swapped = {
      ...f.signatureEnvelope,
      inventorySignature: f.signatureEnvelope.mappingSignature,
      mappingSignature: f.signatureEnvelope.inventorySignature,
    };
    expect(() => preflightSignedLegacyProfileMapping({ ...f, signatureEnvelope: swapped })).toThrow();
    const wrongDomain = {
      ...f.signatureEnvelope,
      inventorySignature: sign(null, Buffer.concat([
        Buffer.from(MAPPING_SIGNATURE_DOMAIN), f.inventoryBytes,
      ]), f.exporter.privateKey).toString('base64url'),
    };
    expect(() => preflightSignedLegacyProfileMapping({ ...f, signatureEnvelope: wrongDomain })).toThrow();
  });
  it('requires independent signer public keys and an unchanged external anchor digest', () => {
    const f = createFixture();
    const sameKey = Buffer.from(JSON.stringify({
      schemaVersion: 1,
      exporterPublicKeyPem: f.exporter.publicKey.export({ format: 'pem', type: 'spki' }),
      approverPublicKeyPem: f.exporter.publicKey.export({ format: 'pem', type: 'spki' }),
    }));
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, trustAnchorBytes: sameKey,
      expectedTrustAnchorSha256: createHash('sha256').update(sameKey).digest('hex'),
    })).toThrow('migration_signer_roles_not_separated');
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, expectedTrustAnchorSha256: '0'.repeat(64),
    })).toThrow('migration_trust_anchor_not_pinned');
  });
  it('denies wrong pin format, invalid JSON, unapproved fields and incomplete signatures', () => {
    const f = createFixture();
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, expectedTrustAnchorSha256: 'not a sha',
    })).toThrow();
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, signatureEnvelope: { ...f.signatureEnvelope, isApproved: true },
    })).toThrow();
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, signatureEnvelope: { schemaVersion: 1, inventorySignature: f.signatureEnvelope.inventorySignature },
    })).toThrow();
    const badAnchor = Buffer.from('not JSON');
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, trustAnchorBytes: badAnchor,
      expectedTrustAnchorSha256: createHash('sha256').update(badAnchor).digest('hex'),
    })).toThrow();
  });
  it('rejects signed records held for erasure/retention rather than treating signatures as migration approval', () => {
    const f = createFixture();
    const held = Buffer.from(JSON.stringify({
      schemaVersion: 1, snapshotId: snap,
      records: [{ ...record, deletionState: 'legal_hold' }],
    }));
    const changed = {
      ...f, inventoryBytes: held,
      signatureEnvelope: {
        ...f.signatureEnvelope,
        inventorySignature: sign(null, Buffer.concat([
          Buffer.from(INVENTORY_SIGNATURE_DOMAIN), held,
        ]), f.exporter.privateKey).toString('base64url'),
      },
    };
    expect(() => preflightSignedLegacyProfileMapping(changed)).toThrow('migration_inventory_unverifiable');
  });
});

// @vitest-environment node
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { preflightLegacyProfileMapping } from '../src/server/multitenant/tenantMigrationPreflight';
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
      Buffer.from(MAPPING_SIGNATURE_DOMAIN),
      createHash('sha256').update(inventoryBytes).digest(),
      mappingBytes,
    ]), approver.privateKey).toString('base64url'),
  };
  const pinnedSnapshot = {
    inventorySha256: createHash('sha256').update(inventoryBytes).digest('hex'),
    mappingSha256: createHash('sha256').update(mappingBytes).digest('hex'),
    reconciliationSha256: preflightLegacyProfileMapping(
      JSON.parse(inventoryBytes.toString('utf8')) as unknown,
      JSON.parse(mappingBytes.toString('utf8')) as unknown,
    ).reconciliationSha256,
  };
  return { inventoryBytes, mappingBytes, trustAnchorBytes, expectedTrustAnchorSha256,
    signatureEnvelope, exporter, approver, pinnedSnapshot };
}
function reSignFixtureWithBytes(f: ReturnType<typeof createFixture>,
  inventoryBytes: Buffer, mappingBytes: Buffer) {
  return {
    ...f, inventoryBytes, mappingBytes,
    pinnedSnapshot: {
      ...f.pinnedSnapshot,
      inventorySha256: createHash('sha256').update(inventoryBytes).digest('hex'),
      mappingSha256: createHash('sha256').update(mappingBytes).digest('hex'),
    },
    signatureEnvelope: {
      ...f.signatureEnvelope,
      inventorySignature: sign(null, Buffer.concat([
        Buffer.from(INVENTORY_SIGNATURE_DOMAIN), inventoryBytes,
      ]), f.exporter.privateKey).toString('base64url'),
      mappingSignature: sign(null, Buffer.concat([
        Buffer.from(MAPPING_SIGNATURE_DOMAIN),
        createHash('sha256').update(inventoryBytes).digest(),
        mappingBytes,
      ]), f.approver.privateKey).toString('base64url'),
    },
  };
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
  it('requires independently pinned expected source and outcome hashes, even with valid signatures', () => {
    const f = createFixture();
    for (const field of ['inventorySha256', 'mappingSha256', 'reconciliationSha256'] as const) {
      const changed = {
        ...f, pinnedSnapshot: { ...f.pinnedSnapshot, [field]: '0'.repeat(64) },
      };
      const expectedError = field === 'reconciliationSha256'
        ? 'migration_reconciliation_pin_mismatch' : 'migration_snapshot_pin_mismatch';
      expect(() => preflightSignedLegacyProfileMapping(changed)).toThrow(expectedError);
    }
  });
  it('refuses missing, malformed, or unapproved control-plane snapshot pins', () => {
    const f = createFixture();
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, pinnedSnapshot: null as unknown as typeof f.pinnedSnapshot,
    })).toThrow();
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, pinnedSnapshot: { ...f.pinnedSnapshot, mappingSha256: 'not a sha' },
    })).toThrow();
    const unapproved = { ...f.pinnedSnapshot, approved: true };
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, pinnedSnapshot: unapproved,
    })).toThrow();
  });
  it('rejects replay of a different fully signed mapping when the reviewed pins are unchanged', () => {
    const f = createFixture();
    const alternate = Buffer.from(f.mappingBytes.toString('utf8').replace(
      '"tenantId":"tenant-one"', '"tenantId":"tenant-two"',
    ));
    expect(alternate.equals(f.mappingBytes)).toBe(false);
    const resigned = reSignFixtureWithBytes(f, f.inventoryBytes, alternate);
    // Model adversarial signer keys while holding reviewer pins unchanged.
    expect(() => preflightSignedLegacyProfileMapping({
      ...resigned, pinnedSnapshot: f.pinnedSnapshot,
    })).toThrow('migration_snapshot_pin_mismatch');
  });
  it('rejects a fully signed mapping with duplicate tenantId despite the last parsed value being valid', () => {
    const f = createFixture();
    const changed = Buffer.from(f.mappingBytes.toString('utf8').replace(
      '"tenantId":"tenant-one"', '"tenantId":"tenant-two","tenantId":"tenant-one"',
    ));
    expect(changed.equals(f.mappingBytes)).toBe(false);
    expect(() => preflightSignedLegacyProfileMapping(
      reSignFixtureWithBytes(f, f.inventoryBytes, changed),
    )).toThrow('migration_json_representation_ambiguous');
  });
  it('rejects a fully signed inventory hiding a legal hold behind a duplicate deletionState', () => {
    const f = createFixture();
    const changed = Buffer.from(f.inventoryBytes.toString('utf8').replace(
      '"deletionState":"none"', '"deletionState":"legal_hold","deletionState":"none"',
    ));
    expect(changed.equals(f.inventoryBytes)).toBe(false);
    expect(() => preflightSignedLegacyProfileMapping(
      reSignFixtureWithBytes(f, changed, f.mappingBytes),
    )).toThrow('migration_json_representation_ambiguous');
  });
  it('rejects correctly signed alternate JSON serializations and byte-order mark', () => {
    const f = createFixture();
    for (const alternative of [
      Buffer.concat([f.inventoryBytes, Buffer.from('\n')]),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), f.inventoryBytes]),
      Buffer.from(JSON.stringify(JSON.parse(f.inventoryBytes.toString('utf8')), null, 2)),
    ]) {
      expect(() => preflightSignedLegacyProfileMapping(
        reSignFixtureWithBytes(f, alternative, f.mappingBytes),
      )).toThrow();
    }
  });
  it('rejects invalid UTF-8 in fully signed input without replacement-character decoding', () => {
    const f = createFixture();
    const invalid = Buffer.concat([f.inventoryBytes, Buffer.from([0xc3, 0x28])]);
    expect(() => preflightSignedLegacyProfileMapping(
      reSignFixtureWithBytes(f, invalid, f.mappingBytes),
    )).toThrow();
  });
  it('rejects duplicate trusted keyring fields even when its exact digest is pinned', () => {
    const f = createFixture();
    const original = f.trustAnchorBytes.toString('utf8');
    const tampered = Buffer.from(original.replace(
      '"schemaVersion":1,', '"schemaVersion":1,"schemaVersion":1,',
    ));
    expect(() => preflightSignedLegacyProfileMapping({
      ...f, trustAnchorBytes: tampered,
      expectedTrustAnchorSha256: createHash('sha256').update(tampered).digest('hex'),
    })).toThrow('migration_json_representation_ambiguous');
  });
  it('rejects exporter-only re-signing of an otherwise equivalent inventory', () => {
    const f = createFixture();
    // An attacker controlling only the exporter key may produce a fresh
    // inventory with identical records and snapshot but changed original
    // bytes. Approver consent for the original bytes must not be reusable.
    const reformatted = Buffer.concat([f.inventoryBytes, Buffer.from('\n')]);
    const attackerSigned = {
      ...f,
      inventoryBytes: reformatted,
      signatureEnvelope: {
        ...f.signatureEnvelope,
        inventorySignature: sign(null, Buffer.concat([
          Buffer.from(INVENTORY_SIGNATURE_DOMAIN), reformatted,
        ]), f.exporter.privateKey).toString('base64url'),
      },
    };
    expect(() => preflightSignedLegacyProfileMapping(attackerSigned))
      .toThrow('migration_signature_verification_failed');
  });
  it('rejects exporter-only changes to hold state with replayed approver signature', () => {
    const f = createFixture();
    const noHold = Buffer.from(JSON.stringify({
      schemaVersion: 1, snapshotId: snap,
      records: [{ ...record, deletionState: 'pending_erasure' }],
    }));
    const attackerSigned = {
      ...f, inventoryBytes: noHold,
      signatureEnvelope: {
        ...f.signatureEnvelope,
        inventorySignature: sign(null, Buffer.concat([
          Buffer.from(INVENTORY_SIGNATURE_DOMAIN), noHold,
        ]), f.exporter.privateKey).toString('base64url'),
      },
    };
    expect(() => preflightSignedLegacyProfileMapping(attackerSigned))
      .toThrow('migration_signature_verification_failed');
  });
  it('rejects V1 mapping signatures without binding to the original inventory hash', () => {
    const f = createFixture();
    const oldProtocol = {
      ...f,
      signatureEnvelope: {
        ...f.signatureEnvelope,
        mappingSignature: sign(null, Buffer.concat([
          Buffer.from('klar:tenant-migration:mapping:v1\0'), f.mappingBytes,
        ]), f.approver.privateKey).toString('base64url'),
      },
    };
    expect(() => preflightSignedLegacyProfileMapping(oldProtocol))
      .toThrow('migration_signature_verification_failed');
  });
  it('rejects signed records held for erasure/retention rather than treating signatures as migration approval', () => {
    const f = createFixture();
    const held = Buffer.from(JSON.stringify({
      schemaVersion: 1, snapshotId: snap,
      records: [{ ...record, deletionState: 'legal_hold' }],
    }));
    const changed = {
      ...f, inventoryBytes: held,
      pinnedSnapshot: {
        ...f.pinnedSnapshot,
        inventorySha256: createHash('sha256').update(held).digest('hex'),
      },
      signatureEnvelope: {
        ...f.signatureEnvelope,
        inventorySignature: sign(null, Buffer.concat([
          Buffer.from(INVENTORY_SIGNATURE_DOMAIN), held,
        ]), f.exporter.privateKey).toString('base64url'),
        // Even a newly approved/signature-bound legal-hold snapshot must
        // be refused by the independent Art.17/preflight rule.
        mappingSignature: sign(null, Buffer.concat([
          Buffer.from(MAPPING_SIGNATURE_DOMAIN),
          createHash('sha256').update(held).digest(),
          f.mappingBytes,
        ]), f.approver.privateKey).toString('base64url'),
      },
    };
    expect(() => preflightSignedLegacyProfileMapping(changed)).toThrow('migration_inventory_unverifiable');
  });
});

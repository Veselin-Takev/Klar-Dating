// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INVENTORY_SIGNATURE_DOMAIN, MAPPING_SIGNATURE_DOMAIN,
} from '../src/server/multitenant/tenantMigrationAttestation';
import { preflightLegacyProfileMapping } from '../src/server/multitenant/tenantMigrationPreflight';

interface Fixture {
  dir: string;
  inventoryPath: string;
  mappingPath: string;
  signaturePath: string;
  anchorPath: string;
  env: NodeJS.ProcessEnv;
}
const cliPath = resolve(process.cwd(), 'scripts/tenant-migration-preflight.ts');
const sha = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

function withFixture(run: (fixture: Fixture) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'klar-migration-cli-'));
  try {
    const snapshotId = '00000000-0000-4000-8000-000000000001';
    const user = 'test_user';
    const record = {
      sourcePath: 'users/' + user, ownerUid: user,
      sourceSha256: 'a'.repeat(64), deletionState: 'none',
    };
    const assignment = {
      sourcePath: record.sourcePath, ownerUid: user, sourceSha256: record.sourceSha256,
      tenantId: 'tenant-one', mappingEvidenceSha256: 'b'.repeat(64),
    };
    const inventory = { schemaVersion: 1, snapshotId, records: [record] };
    const mapping = { schemaVersion: 1, snapshotId, assignments: [assignment] };
    const inventoryBytes = Buffer.from(JSON.stringify(inventory));
    const mappingBytes = Buffer.from(JSON.stringify(mapping));
    const exporter = generateKeyPairSync('ed25519');
    const approver = generateKeyPairSync('ed25519');
    const ringBytes = Buffer.from(JSON.stringify({
      schemaVersion: 1,
      exporterPublicKeyPem: exporter.publicKey.export({ format: 'pem', type: 'spki' }),
      approverPublicKeyPem: approver.publicKey.export({ format: 'pem', type: 'spki' }),
    }));
    const signatureBytes = Buffer.from(JSON.stringify({
      schemaVersion: 1,
      inventorySignature: sign(null, Buffer.concat([
        Buffer.from(INVENTORY_SIGNATURE_DOMAIN), inventoryBytes,
      ]), exporter.privateKey).toString('base64url'),
      mappingSignature: sign(null, Buffer.concat([
        Buffer.from(MAPPING_SIGNATURE_DOMAIN),
        createHash('sha256').update(inventoryBytes).digest(), mappingBytes,
      ]), approver.privateKey).toString('base64url'),
    }));
    const inventoryPath = join(dir, 'inventory.json');
    const mappingPath = join(dir, 'mapping.json');
    const signaturePath = join(dir, 'signatures.json');
    const anchorPath = join(dir, 'keyring.json');
    for (const [path, bytes] of [
      [inventoryPath, inventoryBytes], [mappingPath, mappingBytes],
      [signaturePath, signatureBytes], [anchorPath, ringBytes],
    ] as const) {
      writeFileSync(path, bytes, { mode: 0o600 });
    }
    run({
      dir, inventoryPath, mappingPath, signaturePath, anchorPath,
      env: {
        ...process.env,
        KLAR_MIGRATION_TRUST_ANCHOR_PATH: anchorPath,
        KLAR_MIGRATION_TRUST_ANCHOR_SHA256: sha(ringBytes),
        KLAR_MIGRATION_EXPECTED_INVENTORY_SHA256: sha(inventoryBytes),
        KLAR_MIGRATION_EXPECTED_MAPPING_SHA256: sha(mappingBytes),
        KLAR_MIGRATION_EXPECTED_RECONCILIATION_SHA256:
          preflightLegacyProfileMapping(inventory, mapping).reconciliationSha256,
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function invoke(f: Fixture, options: {
  inventoryPath?: string; mode?: string; env?: NodeJS.ProcessEnv;
} = {}) {
  const result = spawnSync(process.execPath, [
    '--import=tsx', cliPath, options.mode ?? '--dry-run',
    options.inventoryPath ?? f.inventoryPath, f.mappingPath, f.signaturePath,
  ], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
    env: options.env ?? f.env,
  });
  if (result.error) throw result.error;
  return result;
}
function expectDenied(result: ReturnType<typeof invoke>): void {
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('TENANT MIGRATION PREFLIGHT BLOCKED');
  expect(result.stderr).not.toContain('test_user');
}
describe('real signed migration dry-run CLI, without remote Firestore access', () => {
  it('accepts canonical files and returns only a BLOCKED result without altering inputs', () => {
    withFixture(f => {
      const before = readFileSync(f.inventoryPath);
      const result = invoke(f);
      expect(result.status).toBe(0);
      const parsed: unknown = JSON.parse(result.stdout);
      expect(parsed).toMatchObject({
        status: 'BLOCKED_MANUAL_APPROVAL_REQUIRED',
        attestation: 'CRYPTOGRAPHIC_SIGNATURES_VERIFIED_NOT_APPROVAL',
        profileCount: 1, tenantCount: 1,
      });
      expect(result.stdout).not.toContain('test_user');
      expect(result.stderr).toBe('');
      expect(readFileSync(f.inventoryPath)).toEqual(before);
    });
  });
  it('fails closed when an independent expected snapshot pin is missing or mismatched', () => {
    withFixture(f => {
      const omitted = { ...f.env };
      delete omitted.KLAR_MIGRATION_EXPECTED_INVENTORY_SHA256;
      expectDenied(invoke(f, { env: omitted }));
      const corrupted = {
        ...f.env, KLAR_MIGRATION_EXPECTED_MAPPING_SHA256: '0'.repeat(64),
      };
      expectDenied(invoke(f, { env: corrupted }));
    });
  });
  it('rejects direct and ancestor directory symlinks even when file contents are authentic', () => {
    withFixture(f => {
      const directLink = join(f.dir, 'inventory-link.json');
      symlinkSync(f.inventoryPath, directLink);
      expectDenied(invoke(f, { inventoryPath: directLink }));
      const realDir = join(f.dir, 'real');
      mkdirSync(realDir);
      const nested = join(realDir, 'inventory.json');
      writeFileSync(nested, readFileSync(f.inventoryPath));
      const linkedParent = join(f.dir, 'linked');
      symlinkSync(realDir, linkedParent, 'dir');
      expectDenied(invoke(f, { inventoryPath: join(linkedParent, 'inventory.json') }));
    });
  });
  it('rejects noncanonical dot-segment paths and any attempt to request execution', () => {
    withFixture(f => {
      const realDir = join(f.dir, 'empty');
      mkdirSync(realDir);
      expectDenied(invoke(f, {
        inventoryPath: realDir + '/../inventory.json',
      }));
      expectDenied(invoke(f, { mode: '--execute' }));
    });
  });
});

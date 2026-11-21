// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfileMediaE2Manifest } from '../src/server/platform/profileMediaE2Manifest';
import {
  createProfileMediaTokenRevocationPlan,
  executeProfileMediaTokenRevocation,
  type ProfileMediaTokenMetadata,
} from '../src/server/platform/profileMediaTokenRevocation';
import { createCanonicalMediaRef, createProfileMediaRouter } from '../src/server/platform/profileMedia';

const manifestDigest = 'b'.repeat(64);
const objectPath = 'profiles/test-user/avatar.jpg';
const baseMetadata = () => ({
  exists: true,
  generation: '17',
  metageneration: '4',
  customMetadata: {
    firebaseStorageDownloadTokens: 'never-print-this-token',
    retentionClass: 'profile-image',
    ownerVerified: 'true',
  },
});

describe('metageneration-gated profile media token revocation', () => {
  it.each([
    ['migration', 'profile-media-migration.ts', 'Profile-media migration stopped safely.'],
    ['token revocation', 'profile-media-token-revocation.ts', 'Profile-media token revocation stopped safely.'],
  ])('parses the %s CLI entrypoint and fails closed before target selection without a manifest', (_name, filename, expectedMessage) => {
    const testDirectory = dirname(fileURLToPath(import.meta.url));
    const packageDirectory = resolve(testDirectory, '..');
    const scriptPath = resolve(packageDirectory, 'scripts', filename);
    const child = spawnSync(process.execPath, ['--import=tsx', scriptPath], {
      cwd: packageDirectory,
      encoding: 'utf8',
      timeout: 15_000,
      env: { ...process.env, KLAR_E2_STAGING_PROJECT_ID: '', KLAR_E2_STAGING_BUCKET: '' },
    });
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(1);
    expect(child.stderr).toContain(expectedMessage);
    expect(child.stderr).not.toMatch(/SyntaxError|Unexpected token|Cannot use import/i);
    expect(child.stdout).toBe('');
  });
  it('dry-run plans only approved, version-matching objects and performs zero mutations', async () => {
    const patch = vi.fn();
    const inspect = vi.fn(async () => baseMetadata());
    const plan = await createProfileMediaTokenRevocationPlan([{
      objectPath, generation: '17', metageneration: '4',
    }], inspect, manifestDigest);
    expect(plan.summary).toMatchObject({ selected: 1, eligible: 1, tokenMetadataPresent: 1 });
    expect(patch).not.toHaveBeenCalled();
    expect(JSON.stringify(plan.summary)).not.toContain('test-user');
    expect(JSON.stringify(plan)).not.toContain('never-print-this-token');
  });

  it('clears only the token key using the current metageneration and verifies unrelated metadata', async () => {
    let current: ProfileMediaTokenMetadata = baseMetadata();
    const patch = vi.fn(async (
      _path: string,
      update: { firebaseStorageDownloadTokens: null },
      options: { ifMetagenerationMatch: string },
    ) => {
      expect(update).toEqual({ firebaseStorageDownloadTokens: null });
      expect(options).toEqual({ ifMetagenerationMatch: '4' });
      const next: Record<string, string | undefined> = { ...(current.customMetadata ?? {}) };
      delete next.firebaseStorageDownloadTokens;
      current = { ...current, metageneration: '5', customMetadata: next };
    });
    const plan = await createProfileMediaTokenRevocationPlan([{
      objectPath, generation: '17', metageneration: '4',
    }], async () => baseMetadata(), manifestDigest);
    const result = await executeProfileMediaTokenRevocation(plan, {
      readMetadata: async () => current,
      patchCustomMetadata: patch,
    });
    expect(result).toEqual({ revoked: 1, alreadyAbsent: 0, missing: 0, conflicts: 0, stopped: false });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(current.customMetadata).toEqual({ retentionClass: 'profile-image', ownerVerified: 'true' });

    const bytes = Buffer.from('profile-media-bytes-after-revocation');
    const profileState = {
      isAdult: true, active: true, isSuspended: false, isBlocked: false, deletionPending: false,
    };
    const db = {
      collection: (name: string) => {
        if (name === 'users') return {
          doc: (_uid: string) => ({ get: async () => ({ exists: true, data: () => profileState }) }),
        };
        if (name === 'account_deletions') return {
          doc: (_uid: string) => ({ get: async () => ({ exists: false }) }),
        };
        return {
          where: (_field: string, _op: string, _value: string) => ({
            where: (_nextField: string, _nextOp: string, _nextValue: string) => ({
              limit: (_count: number) => ({ get: async () => ({ empty: true }) }),
            }),
          }),
        };
      },
    };
    const file = {
      exists: async () => [true],
      getMetadata: async () => [{
        contentType: 'image/jpeg',
        size: String(bytes.length),
        metadata: current.customMetadata,
      }],
      createReadStream: () => Readable.from([bytes]),
    };
    const app = express();
    app.use('/api', createProfileMediaRouter({
      getFirestore: () => db as never,
      getAuth: () => ({
        verifyIdToken: async (token: string, checkRevoked: boolean) => {
          if (token !== 'proxy-auth-token' || checkRevoked !== true) throw new Error('invalid test token');
          return { uid: 'test-viewer', firebase: { sign_in_provider: 'password' } };
        },
      }) as never,
      getBucket: () => ({ file: (_path: string) => file }) as never,
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const canonical = createCanonicalMediaRef('test-user', objectPath);
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/profile-media/test-user/${encodeURIComponent(canonical)}`;
      const response = await fetch(url, { headers: { Authorization: 'Bearer proxy-auth-token' } });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('stops on a metageneration precondition conflict without retrying or processing later objects', async () => {
    const second = 'profiles/test-user/second.jpg';
    const plan = await createProfileMediaTokenRevocationPlan([
      { objectPath, generation: '17', metageneration: '4' },
      { objectPath: second, generation: '17', metageneration: '4' },
    ], async () => baseMetadata(), manifestDigest);
    const patch = vi.fn(async () => { throw Object.assign(new Error('precondition'), { code: 412 }); });
    const result = await executeProfileMediaTokenRevocation(plan, {
      readMetadata: async () => baseMetadata(),
      patchCustomMetadata: patch,
    });
    expect(result).toMatchObject({ revoked: 0, conflicts: 1, stopped: true });
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('requires an exact allowlisted staging identity and an independently pinned manifest digest for execution', () => {
    const now = new Date();
    const manifest = {
      version: 1 as const,
      environment: 'staging' as const,
      approved: true as const,
      approvalId: 'CHANGE-APPROVAL-206-E2',
      approvedAt: new Date(now.getTime() - 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
      projectId: 'klar-staging-01',
      bucketName: 'klar-staging-01.appspot.com',
      objectCohort: [{ objectPath, generation: '17', metageneration: '4' }],
    };
    const env = {
      KLAR_E2_STAGING_PROJECT_ID: manifest.projectId,
      KLAR_E2_STAGING_BUCKET: manifest.bucketName,
      KLAR_E2_APPROVED_MANIFEST_SHA256: manifestDigest,
    } as NodeJS.ProcessEnv;
    expect(() => validateProfileMediaE2Manifest(manifest, {
      projectId: manifest.projectId, bucketName: manifest.bucketName, env,
    })).not.toThrow();
    const productionManifest = { ...manifest, projectId: 'klar-production-01' };
    expect(() => validateProfileMediaE2Manifest(productionManifest, {
      projectId: productionManifest.projectId, bucketName: productionManifest.bucketName, env,
    })).toThrow('Production-like');
    expect(() => validateProfileMediaE2Manifest(manifest, {
      projectId: 'unrecognized-staging', bucketName: manifest.bucketName, env,
    })).toThrow('does not match');
    expect(() => validateProfileMediaE2Manifest(manifest, {
      projectId: manifest.projectId, bucketName: manifest.bucketName, env,
      execute: true, confirmStagingExecution: false, manifestDigest,
    })).toThrow('explicit staging confirmation');
    expect(() => validateProfileMediaE2Manifest(manifest, {
      projectId: manifest.projectId, bucketName: manifest.bucketName, env: {
        ...env, KLAR_E2_APPROVED_MANIFEST_SHA256: '0'.repeat(64),
      } as NodeJS.ProcessEnv,
      execute: true, confirmStagingExecution: true, manifestDigest,
    })).toThrow('independently pinned');
  });

  it('rejects manifest mismatches before mutation', async () => {
    const plan = await createProfileMediaTokenRevocationPlan([{
      objectPath, generation: '16', metageneration: '4',
    }], async () => baseMetadata(), manifestDigest);
    expect(plan.summary.manifestMismatches).toBe(1);
    const patch = vi.fn();
    await expect(executeProfileMediaTokenRevocation(plan, {
      readMetadata: async () => baseMetadata(),
      patchCustomMetadata: patch,
    })).rejects.toThrow('manifest mismatches');
    expect(patch).not.toHaveBeenCalled();
  });
});

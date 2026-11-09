// @vitest-environment node
import { it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

it.skipIf(!process.env.FIREBASE_AUTH_EMULATOR_HOST)('native CLI dry-run leaves Auth untouched; apply and resume revoke once', async () => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST!;
  if (!/^(127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(host)) throw new Error('native_migration_requires_loopback');
  const app = initializeApp({projectId: 'demo-klar'}, 'migration-native');
  const auth = getAuth(app).tenantManager().authForTenant('migration-native');
  const directory = await mkdtemp(join(tmpdir(), 'klar-auth-migration-'));
  const uid = 'migration-native-' + Date.now();
  const script = 'scripts/migrate-revoke-legacy-tokens.ts';
  try {
    await auth.createUser({uid});
    const signIn = async () => {
      const response = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=synthetic-emulator-key`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: await auth.createCustomToken(uid), tenantId: 'migration-native', returnSecureToken: true}),
      });
      expect(response.ok).toBe(true);
      const data = await response.json() as {idToken: string};
      expect(typeof data.idToken).toBe('string');
      return data.idToken;
    };
    const oldSession = await signIn();
    await auth.verifyIdToken(oldSession, true);
    const before = (await auth.getUser(uid)).tokensValidAfterTime;
    await new Promise(done => setTimeout(done, 3100));
    const cutoff = new Date(Date.now() - 2000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const args = ['--project=demo-klar', '--tenant=migration-native', '--cutoff=' + cutoff,
      '--checkpoint=' + join(directory, 'state.json'), '--emulator'];
    const run = async (extra: string[] = []) => {
      const result = await promisify(execFile)(process.execPath, ['--import=tsx', script, ...args, ...extra], {cwd: process.cwd(), env: process.env, timeout: 30000});
      return JSON.parse(result.stdout.trim());
    };
    const dry = await run();
    expect(dry).toMatchObject({mode: 'dry-run', eligible: 1, revoked: 0, completed: true, emulator: true});
    expect((await auth.getUser(uid)).tokensValidAfterTime).toBe(before);
    await auth.verifyIdToken(oldSession, true);
    expect(JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')).completed).toBe(false);
    const apply = await run(['--apply']); expect(apply.revoked).toBe(1);
    const after = (await auth.getUser(uid)).tokensValidAfterTime;
    expect(Date.parse(after!)).toBeGreaterThan(Date.parse(cutoff));
    await expect(auth.verifyIdToken(oldSession, true)).rejects.toMatchObject({code: 'auth/id-token-revoked'});
    const newSession = await signIn();
    await auth.verifyIdToken(newSession, true);
    const repeat = await run(['--apply']); expect(repeat).toMatchObject({revoked: 0, inspected: 0, completed: true});
    expect((await auth.getUser(uid)).tokensValidAfterTime).toBe(after);
    await auth.verifyIdToken(newSession, true);
    await expect(promisify(execFile)(process.execPath, ['--import=tsx', script, ...args.filter(arg => !arg.startsWith('--tenant=')), '--tenant=other', '--apply'], {env: process.env})).rejects.toThrow();
    expect((await auth.getUser(uid)).tokensValidAfterTime).toBe(after);
  } finally {
    await auth.deleteUser(uid); await deleteApp(app); await rm(directory, {recursive: true, force: true});
  }
}, 60000);

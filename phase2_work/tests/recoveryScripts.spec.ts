// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function fakeGcloud() {
  const dir = await mkdtemp(join(tmpdir(), 'klar-gcloud-'));
  tempDirs.push(dir);
  const log = join(dir, 'args.log');
  const executable = join(dir, 'gcloud');
  await writeFile(executable, '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$GCLOUD_ARGS_LOG"\n', 'utf8');
  await chmod(executable, 0o755);
  return { dir, log };
}

function run(script: string, env: Record<string, string>) {
  return spawnSync('bash', [resolve(script)], {
    cwd: resolve('.'),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

describe('Firestore recovery database targeting', () => {
  it('passes the explicit database id to backup export', async () => {
    const fake = await fakeGcloud();
    const result = run('scripts/backup-firestore.sh', {
      PATH: fake.dir + ':' + (process.env.PATH ?? ''),
      GCLOUD_ARGS_LOG: fake.log,
      KLAR_PROJECT_ID: 'klar-drill',
      KLAR_BACKUP_BUCKET: 'gs://klar-backups',
      FIRESTORE_DATABASE_ID: 'klar-primary',
    });
    expect(result.status).toBe(0);
    expect(await readFile(fake.log, 'utf8')).toContain('firestore export');
    expect(await readFile(fake.log, 'utf8')).toContain('--database klar-primary');
  });

  it('passes the explicit database id to restore import', async () => {
    const fake = await fakeGcloud();
    const result = run('scripts/restore-firestore.sh', {
      PATH: fake.dir + ':' + (process.env.PATH ?? ''),
      GCLOUD_ARGS_LOG: fake.log,
      KLAR_PROJECT_ID: 'klar-drill',
      KLAR_CONFIRM_RESTORE: 'klar-drill',
      KLAR_BACKUP_URI: 'gs://klar-backups/firestore/klar-drill/export-1',
      FIRESTORE_DATABASE_ID: 'klar-primary',
    });
    expect(result.status).toBe(0);
    const args = await readFile(fake.log, 'utf8');
    expect(args).toContain('firestore import');
    expect(args).toContain('--database klar-primary');
  });

  it.each(['scripts/backup-firestore.sh', 'scripts/restore-firestore.sh'])(
    'fails before invoking gcloud when database id is missing: %s',
    async script => {
      const fake = await fakeGcloud();
      const result = run(script, {
        PATH: fake.dir + ':' + (process.env.PATH ?? ''),
        GCLOUD_ARGS_LOG: fake.log,
        KLAR_PROJECT_ID: 'klar-drill',
        KLAR_BACKUP_BUCKET: 'gs://klar-backups',
        KLAR_BACKUP_URI: 'gs://klar-backups/firestore/klar-drill/export-1',
        KLAR_CONFIRM_RESTORE: 'klar-drill',
        FIRESTORE_DATABASE_ID: '',
      });
      expect(result.status).not.toBe(0);
      await expect(readFile(fake.log, 'utf8')).rejects.toThrow();
    },
  );
});

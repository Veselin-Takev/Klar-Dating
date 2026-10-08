// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function fakeTools() {
  const dir = await mkdtemp(join(tmpdir(), 'klar-rollback-'));
  tempDirs.push(dir);
  const log = join(dir, 'args.log');
  const gcloud = join(dir, 'gcloud');
  const curl = join(dir, 'curl');
  await writeFile(gcloud, `#!/usr/bin/env bash
printf "gcloud %s\\n" "$*" >> "$TOOL_ARGS_LOG"
if [[ "$*" == *"services describe"*"latestReadyRevisionName"* ]]; then echo "current-rev"; exit 0; fi
if [[ "$*" == *"revisions list"* ]]; then
  if [[ "\${TARGET_EXISTS:-true}" == "true" ]]; then echo "known-good"; fi
  exit 0
fi
if [[ "$*" == *"services describe"*"status.url"* ]]; then echo "https://service.example"; exit 0; fi
exit 0
`, 'utf8');
  await writeFile(curl, '#!/usr/bin/env bash\nprintf "curl %s\\n" "$*" >> "$TOOL_ARGS_LOG"\nexit 0\n', 'utf8');
  await chmod(gcloud, 0o755);
  await chmod(curl, 0o755);
  return { dir, log };
}

function run(dir: string, log: string, extra: Record<string, string> = {}) {
  return spawnSync('bash', [resolve('scripts/rollback-cloud-run.sh')], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      PATH: dir + ':' + (process.env.PATH ?? ''),
      TOOL_ARGS_LOG: log,
      TARGET_EXISTS: 'true',
      KLAR_PROJECT_ID: 'klar-prod',
      KLAR_REGION: 'europe-west3',
      KLAR_SERVICE: 'klar-app',
      KLAR_ROLLBACK_REVISION: 'known-good',
      KLAR_CONFIRM_ROLLBACK: 'rollback',
      KLAR_ROLLBACK_EVIDENCE_DIR: join(dir, 'evidence'),
      ...extra,
    },
    encoding: 'utf8',
  });
}

describe('Cloud Run rollback script', () => {
  it('verifies membership, switches traffic by revision, checks health, and writes evidence', async () => {
    const fake = await fakeTools();
    const result = run(fake.dir, fake.log);
    expect(result.status).toBe(0);
    const args = await readFile(fake.log, 'utf8');
    expect(args).toContain('revisions list --service klar-app');
    expect(args).toContain('update-traffic klar-app');
    expect(args).toContain('--to-revisions known-good=100');
    expect(args).toContain('curl --fail');
    const evidenceDir = join(fake.dir, 'evidence');
    const names = await readdir(evidenceDir);
    expect(names).toHaveLength(1);
    const evidence = JSON.parse(await readFile(join(evidenceDir, names[0]!), 'utf8'));
    expect(evidence).toMatchObject({
      fromRevision: 'current-rev',
      toRevision: 'known-good',
      trafficPercent: 100,
      health: 'passed',
      readiness: 'passed',
    });
  });

  it('refuses a target revision that does not belong to the service before traffic changes', async () => {
    const fake = await fakeTools();
    const result = run(fake.dir, fake.log, { TARGET_EXISTS: 'false' });
    expect(result.status).not.toBe(0);
    const args = await readFile(fake.log, 'utf8');
    expect(args).not.toContain('update-traffic');
  });

  it('requires an explicit rollback confirmation before invoking cloud tools', async () => {
    const fake = await fakeTools();
    const result = run(fake.dir, fake.log, { KLAR_CONFIRM_ROLLBACK: 'no' });
    expect(result.status).not.toBe(0);
    await expect(readFile(fake.log, 'utf8')).rejects.toThrow();
  });
});

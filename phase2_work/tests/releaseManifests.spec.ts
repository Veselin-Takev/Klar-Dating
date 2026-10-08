// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directories: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'klar-release-')); directories.push(root);
  cpSync('deploy', join(root, 'deploy'), { recursive: true }); return root;
}
const run = (root: string, ...args: string[]) => spawnSync(process.execPath,
  [resolve('scripts/release-manifests.mjs'), ...args], { cwd: root, encoding: 'utf8' });
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe('release manifest integrity', () => {
  it('renders both manifests with exactly the build digest and keeps operational limits', () => {
    const root = fixture(); const output = join(root, 'output');
    const owner = process.env.GITHUB_REPOSITORY_OWNER ?? 'veselin8606-source';
    const image = 'ghcr.io/' + owner + '/klar-app@sha256:' + 'abcdef0123456789'.repeat(4);
    const result = run(root, 'render', image, output); expect(result.status, result.stderr).toBe(0);
    for (const name of ['cloud-run', 'service']) {
      const manifest = JSON.parse(readFileSync(join(output, name + '.json'), 'utf8'));
      expect(manifest.spec.template.spec.containers[0].image).toBe(image);
      expect(manifest.spec.template.metadata.annotations['autoscaling.knative.dev/maxScale']).toBe('10');
    }
  });
  it.each([':latest', '@sha256:REPLACE_WITH_VERIFIED_DIGEST', '@sha256:1234'])(
    'rejects unresolved or mutable images: %s', suffix => {
      const root = fixture(); expect(run(root, 'render', 'ghcr.io/' + (process.env.GITHUB_REPOSITORY_OWNER ?? 'veselin8606-source') + '/klar-app' + suffix, join(root, 'out')).status).toBe(1);
    },
  );
  it('blocks reintroduced placeholder manifests in CI', () => {
    const root = fixture(); writeFileSync(join(root, 'cloud-run.yaml'), 'image: REPLACE_WITH_VERIFIED_DIGEST');
    expect(run(root, 'check').status).toBe(1);
  });
});

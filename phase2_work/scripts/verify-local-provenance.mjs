import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

export function verifyLocalProvenance(cwd, git = execFileSync, canonicalize = realpathSync) {
  const invoke = (args) => git('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const root = invoke(['rev-parse', '--show-toplevel']);
  if (canonicalize(root) !== canonicalize(cwd)) throw new Error('Local preflight must run against the repository root.');
  const sha = invoke(['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid Git HEAD SHA.');
  const status = invoke(['status', '--porcelain', '--untracked-files=normal']);
  if (status) throw new Error('Uncommitted or untracked files: local release evidence requires a clean checkout.');
  return sha;
}

import { execFileSync } from 'node:child_process';

export function verifyLocalProvenance(cwd, git = execFileSync) {
  const invoke = (args) => git('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const sha = invoke(['rev-parse', '--verify', 'HEAD']);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid Git HEAD SHA.');
  const status = invoke(['status', '--porcelain', '--untracked-files=normal']);
  if (status) throw new Error('Uncommitted or untracked files: local release evidence requires a clean checkout.');
  return sha;
}

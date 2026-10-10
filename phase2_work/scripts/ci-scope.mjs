import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Only narrative files that are not build or release inputs may take this path.
const narrativeOnly = new Set([
  'phase2_work/docs/PROJECT_STATUS.md',
  'phase2_work/docs/ENTERPRISE_END_TO_END_AUDIT_2026-10-09.md',
  'phase2_work/docs/CI_RESOURCE_POLICY.md',
]);
export function requiresFullValidation(paths, eventName) {
  return eventName !== 'pull_request' || paths.length === 0 || paths.some(file => !narrativeOnly.has(file));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let full = true;
  try {
    const { CI_BASE_SHA: base, CI_HEAD_SHA: head, GITHUB_EVENT_NAME: eventName } = process.env;
    if (eventName === 'pull_request' && /^[a-f0-9]{40}$/.test(base || '') && /^[a-f0-9]{40}$/.test(head || '')) {
      const files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`, '--'], { encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 }).split('\0').filter(Boolean);
      full = requiresFullValidation(files, eventName);
    }
  } catch {
    console.warn('Change scope unavailable; full validation required.');
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
  console.log(full ? 'Full validation required.' : 'Narrative-only change: application inputs unchanged.');
}

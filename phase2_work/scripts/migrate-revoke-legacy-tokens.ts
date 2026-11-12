/** Operator-only Auth migration. No production mutation without --apply.
 * Receipts contain aggregate counts only; private checkpoints may contain an
 * opaque provider pagination cursor. Never log the checkpoint. */
import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { BaseAuth, UserRecord } from 'firebase-admin/auth';
import { open, readFile, rename, unlink, realpath, lstat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Options = {
  project: string; tenant: string; cutoff: string; checkpoint: string;
  apply: boolean; emulator: boolean; maxUsers: number;
};
export function parseOptions(args: string[], now = Date.now(), env = process.env): Options {
  const flags = new Map<string, string>();
  for (const arg of args) {
    const match = /^(--[a-z-]+)(?:=(.+))?$/.exec(arg);
    if (!match || flags.has(match[1]!) || (!match[2] && !['--apply','--emulator'].includes(match[1]!))) throw new Error('invalid_arguments');
    flags.set(match[1]!, match[2] ?? 'true');
  }
  const allowed = ['--project', '--tenant', '--cutoff', '--checkpoint', '--apply', '--emulator', '--max-users'];
  if ([...flags.keys()].some(key => !allowed.includes(key))) throw new Error('unknown_argument');
  for (const flag of ['--apply', '--emulator']) if (flags.has(flag) && flags.get(flag) !== 'true') throw new Error('invalid_flag');
  const project = flags.get('--project') ?? '', tenant = flags.get('--tenant') ?? '';
  const cutoff = flags.get('--cutoff') ?? '', checkpoint = flags.get('--checkpoint') ?? '';
  const maxUsers = Number(flags.get('--max-users') ?? 1000), emulator = flags.has('--emulator');
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) || !/^(default|[A-Za-z0-9_-]{1,128})$/.test(tenant)
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(cutoff)
    || !Number.isFinite(Date.parse(cutoff)) || new Date(cutoff).toISOString().replace('.000Z', 'Z') !== cutoff
    || Date.parse(cutoff) > now - 2000 || !checkpoint || !Number.isSafeInteger(maxUsers) || maxUsers < 1 || maxUsers > 100000)
    throw new Error('explicit_valid_scope_cutoff_checkpoint_required');
  const host = env.FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator ? (!project.startsWith('demo-') || !host || !/^(127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(host))
    : (project.startsWith('demo-') || !!host)) throw new Error('auth_environment_mismatch');
  return {project, tenant, cutoff, checkpoint: resolve(checkpoint), apply: flags.has('--apply'), emulator, maxUsers};
}

type State = { version: 1; project: string; tenant: string; cutoff: string; emulator: boolean; cursor?: string; completed: boolean };
export type Receipt = { mode: string; project: string; tenant: string; cutoff: string; emulator: boolean;
  inspected: number; eligible: number; revoked: number; alreadyRevoked: number; newerAccounts: number; disappeared: number; completed: boolean };
type AuthPort = Pick<BaseAuth, 'listUsers' | 'getUser' | 'revokeRefreshTokens'>;
function validAfter(user: UserRecord): number { return Date.parse(user.tokensValidAfterTime ?? ''); }
const missingUser = (error: unknown) => (error as {code?: string})?.code === 'auth/user-not-found';

export async function migrate(auth: AuthPort, options: Options, state: State,
  save: (state: State) => Promise<void>, pause: () => Promise<void> = () => new Promise(done => setTimeout(done, 100))): Promise<Receipt> {
  const receipt: Receipt = {mode: options.apply ? 'apply' : 'dry-run', project: options.project, tenant: options.tenant,
    cutoff: options.cutoff, emulator: options.emulator, inspected: 0, eligible: 0, revoked: 0,
    alreadyRevoked: 0, newerAccounts: 0, disappeared: 0, completed: options.apply && state.completed};
  if (receipt.completed) return receipt;
  let cursor = options.apply ? state.cursor : undefined;
  const cutoff = Date.parse(options.cutoff);
  do {
    const page = await auth.listUsers(Math.min(100, options.maxUsers - receipt.inspected), cursor);
    for (const listed of page.users) {
      receipt.inspected++;
      const created = Date.parse(listed.metadata.creationTime);
      if (!Number.isFinite(created)) throw new Error('invalid_auth_creation_time');
      if (created > cutoff) { receipt.newerAccounts++; continue; }
      try {
        // Re-read authoritative state: a crash after revoke but before checkpoint
        // must not revoke sessions established after that first successful revoke.
        const current = await auth.getUser(listed.uid);
        const currentCreated = Date.parse(current.metadata.creationTime);
        if (!Number.isFinite(currentCreated)) throw new Error('invalid_auth_creation_time');
        if (currentCreated > cutoff) { receipt.newerAccounts++; continue; }
        if (validAfter(current) > cutoff) { receipt.alreadyRevoked++; continue; }
        receipt.eligible++;
        if (options.apply) {
          await pause();
          await auth.revokeRefreshTokens(listed.uid);
          if (!(validAfter(await auth.getUser(listed.uid)) > cutoff)) throw new Error('auth_revocation_not_confirmed');
          receipt.revoked++;
        }
      } catch (error) {
        if (!missingUser(error)) throw new Error('auth_migration_page_failed', {cause: undefined});
        receipt.disappeared++;
      }
    }
    cursor = page.pageToken;
    receipt.completed = !cursor;
    // A failed page never advances. Dry-runs never consume the apply cursor.
    if (options.apply) await save({...state, cursor, completed: !cursor});
  } while (cursor && receipt.inspected < options.maxUsers);
  return receipt;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  const repository = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const parent = await realpath(dirname(options.checkpoint));
  const rel = relative(repository, parent);
  if (rel === '' || (!rel.startsWith('..' + sep) && rel !== '..')) throw new Error('checkpoint_must_be_outside_repository');
  options.checkpoint = resolve(parent, options.checkpoint.split(sep).pop()!);
  const lockPath = options.checkpoint + '.lock';
  const lock = await open(lockPath, 'wx', 0o600);
  let app: ReturnType<typeof initializeApp> | undefined;
  const expected: State = {version: 1, project: options.project, tenant: options.tenant, cutoff: options.cutoff, emulator: options.emulator, completed: false};
  try {
    let state = expected;
    try {
      const stat = await lstat(options.checkpoint);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('unsafe_checkpoint');
      state = JSON.parse(await readFile(options.checkpoint, 'utf8')) as State;
      for (const key of ['version', 'project', 'tenant', 'cutoff', 'emulator'] as const)
        if (state[key] !== expected[key]) throw new Error('checkpoint_scope_mismatch');
      if (typeof state.completed !== 'boolean' || (state.cursor !== undefined && typeof state.cursor !== 'string')) throw new Error('invalid_checkpoint');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const save = async (next: State) => {
      const temporary = options.checkpoint + '.next';
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(next) + '\n'); await file.sync(); } finally { await file.close(); }
      await rename(temporary, options.checkpoint);
    };
    // Persist the immutable boundary even in dry-run; no Auth writes take place.
    if (state === expected) await save(state);
    app = initializeApp({projectId: options.project, ...(options.emulator ? {} : {credential: applicationDefault()})}, 'legacy-session-migration');
    const root = getAuth(app);
    const auth = options.tenant === 'default' ? root : root.tenantManager().authForTenant(options.tenant);
    const receipt = await migrate(auth, options, state, save);
    console.log(JSON.stringify(receipt));
    if (!receipt.completed) process.exitCode = 3;
    return receipt;
  } finally {
    if (app) await deleteApp(app);
    await lock.close();
    await unlink(lockPath);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch(() => { console.error(JSON.stringify({event: 'legacy_token_migration_failed'})); process.exitCode = 1; });
}

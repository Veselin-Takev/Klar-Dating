// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import type { UserRecord } from 'firebase-admin/auth';
import { parseOptions, migrate } from '../scripts/migrate-revoke-legacy-tokens';
import { collectIam } from '../scripts/export-live-iam-evidence';

const cutoff = '2026-01-02T00:00:00Z';
const args = ['--project=real-project', '--tenant=default', '--cutoff=' + cutoff, '--checkpoint=/tmp/checkpoint.json'];
const options = () => parseOptions(args, Date.parse('2026-01-03'), {});
const state = () => ({version: 1 as const, project: 'real-project', tenant: 'default', cutoff, emulator: false, completed: false});
const user = (uid: string, valid = '2026-01-01', created = '2026-01-01') => ({uid, tokensValidAfterTime: valid, metadata: {creationTime: created}} as UserRecord);
function fixture(users = [user('first')]) {
  const auth = {
    listUsers: vi.fn(async () => ({users, pageToken: undefined as string | undefined})),
    getUser: vi.fn(async (uid: string) => users.find(item => item.uid === uid)!),
    revokeRefreshTokens: vi.fn(async (uid: string) => { Object.assign(users.find(item => item.uid === uid)!, {tokensValidAfterTime: '2026-01-03'}); }),
  };
  return auth;
}
describe('legacy Auth revocation migration', () => {
  it('dry-run performs no Auth writes and does not advance apply state', async () => {
    const auth = fixture(), save = vi.fn();
    const result = await migrate(auth, options(), state(), save);
    expect(result).toMatchObject({mode: 'dry-run', eligible: 1, revoked: 0, completed: true});
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it('confirms revoke and repeated execution preserves subsequent sessions', async () => {
    const auth = fixture(), config = {...options(), apply: true}, save = vi.fn();
    expect((await migrate(auth, config, state(), save, async () => {})).revoked).toBe(1);
    expect((await migrate(auth, config, state(), save, async () => {})).alreadyRevoked).toBe(1);
    expect(auth.revokeRefreshTokens).toHaveBeenCalledTimes(1);
  });
  it('recovers when revoke succeeds but checkpoint persistence fails', async () => {
    const auth = fixture(), config = {...options(), apply: true};
    await expect(migrate(auth, config, state(), async () => {throw new Error('disk');}, async () => {})).rejects.toThrow();
    await migrate(auth, config, state(), vi.fn(), async () => {});
    expect(auth.revokeRefreshTokens).toHaveBeenCalledTimes(1);
  });
  it('never advances a page after a provider failure', async () => {
    const auth = fixture(), save = vi.fn(); auth.revokeRefreshTokens.mockRejectedValue(new Error('provider'));
    await expect(migrate(auth, {...options(), apply: true}, state(), save, async () => {})).rejects.toThrow('auth_migration_page_failed');
    expect(save).not.toHaveBeenCalled();
  });
  it('requires the provider postcondition before checkpointing', async () => {
    const auth = fixture(), save = vi.fn(); auth.revokeRefreshTokens.mockImplementation(async () => {});
    await expect(migrate(auth, {...options(), apply: true}, state(), save, async () => {})).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });
  it('skips accounts created after the immutable boundary', async () => {
    const auth = fixture([user('new', '2026-01-01', '2026-01-03')]);
    expect((await migrate(auth, {...options(), apply: true}, state(), vi.fn())).newerAccounts).toBe(1);
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });
  it('resumes pagination under an invocation limit', async () => {
    const auth = fixture(); auth.listUsers.mockResolvedValue({users: [user('first')], pageToken: 'next'});
    const save = vi.fn();
    const result = await migrate(auth, {...options(), apply: true, maxUsers: 1}, {...state(), cursor: 'previous'}, save, async () => {});
    expect(auth.listUsers).toHaveBeenCalledWith(1, 'previous');
    expect(result.completed).toBe(false); expect(save.mock.calls[0]![0].cursor).toBe('next');
  });
  it('does not enumerate or mutate after durable completion', async () => {
    const auth = fixture();
    expect((await migrate(auth, {...options(), apply: true}, {...state(), completed: true}, vi.fn())).completed).toBe(true);
    expect(auth.listUsers).not.toHaveBeenCalled();
  });
  it('treats deletion races as idempotent without logging account details', async () => {
    const auth = fixture(); auth.getUser.mockRejectedValue({code: 'auth/user-not-found', email: 'private@example.test'});
    const result = await migrate(auth, {...options(), apply: true}, state(), vi.fn());
    expect(result.disappeared).toBe(1); expect(JSON.stringify(result)).not.toContain('private');
  });
  it.each([
    [...args, '--apply=false'], [...args, '--unknown'], [...args, '--tenant=default'],
    [...args.filter(arg => !arg.startsWith('--cutoff=')), '--cutoff=2099-01-01T00:00:00Z'],
    [...args, '--max-users=0'], [...args.filter(arg => !arg.startsWith('--project=')), '--project=--help'],
  ].map(values => ({values})))('rejects ambiguous or unsafe arguments $values', ({values}) =>
    expect(() => parseOptions(values, Date.parse('2026-01-03'), {})).toThrow());
  it('refuses production/emulator mixups', () => {
    expect(() => parseOptions(args, Date.parse('2026-01-03'), {FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'})).toThrow();
    expect(() => parseOptions([...args, '--emulator'], Date.parse('2026-01-03'), {FIREBASE_AUTH_EMULATOR_HOST: 'remote:9099'})).toThrow();
  });
});

const scope = {project: 'real-project', region: 'europe-west3', service: 'klar-app-backend', bucket: 'real-project.firebasestorage.app'};
function cloudFixture() {
  return vi.fn((command: string[]) => {
    if (command[1] === 'get-ancestors') return [{type: 'project', id: '123'}, {type: 'folder', id: '456'}, {type: 'organization', id: '789'}] as any;
    if (command.includes('get-iam-policy')) return {bindings: []};
    if (command[1] === 'services') return {spec: {template: {spec: {serviceAccountName: 'klar-runtime@real-project.iam.gserviceaccount.com'}}}, status: {traffic: [{revisionName: 'klar-app-backend-001', percent: 50}, {revisionName: 'klar-app-backend-002', percent: 50}]}};
    if (command[1] === 'revisions') return {spec: {serviceAccountName: 'klar-runtime@real-project.iam.gserviceaccount.com'}};
    return {};
  });
}
describe('read-only IAM evidence collection', () => {
  it('exports all serving identities and hierarchy policies without mutating IAM', () => {
    const run = cloudFixture(), result = collectIam(scope, run);
    expect(result.summary.identities).toHaveLength(2); expect(result.summary.runtimeIdentityMatches).toBe(true);
    expect(run.mock.calls.some(([args]) => args.join(' ').includes('organizations get-iam-policy 789'))).toBe(true);
    expect(run.mock.calls.some(([args]) => args.join(' ').includes('resource-manager folders get-iam-policy 456'))).toBe(true);
    expect(run.mock.calls.every(([args]) => !args.some(value => ['set-iam-policy','add-iam-policy-binding','deploy','delete'].includes(value)))).toBe(true);
    expect(result.summary.reviewStatus).toBe('HUMAN_LEAST_PRIVILEGE_REVIEW_REQUIRED');
  });
  it('propagates unavailable policies and publishes no success receipt', () => {
    expect(() => collectIam(scope, () => {throw new Error('permission_denied');})).toThrow();
  });
  it('rejects missing runtime revisions', () => expect(() => collectIam(scope, () => ({}))).toThrow());
  it('records an identity mismatch without attesting least privilege', () => {
    const original = cloudFixture();
    const result = collectIam(scope, args => args[1] === 'revisions' ? {spec: {serviceAccountName: 'default@real-project.iam.gserviceaccount.com'}} : original(args));
    expect(result.summary.runtimeIdentityMatches).toBe(false);
  });
  it('refuses unconfirmed target scope before cloud requests', () => {
    const run = cloudFixture(); expect(() => collectIam({...scope, project: '--help'}, run)).toThrow(); expect(run).not.toHaveBeenCalled();
  });
});

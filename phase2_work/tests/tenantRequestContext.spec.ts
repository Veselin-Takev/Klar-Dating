import { describe, expect, it } from 'vitest';
import { resolveVerifiedTenantContext } from '../src/server/tenantRequestContext';
describe('verified principal to immutable request context', () => {
  it('resolves default namespace only from the verified UID', () => {
    const source = {uid: 'owner', firebase: {sign_in_provider: 'password'}};
    const context = resolveVerifiedTenantContext(source);
    source.uid = 'other';
    expect(context).toEqual({tenant: 'default', uid: 'owner'});
    expect(Object.isFrozen(context)).toBe(true);
  });
  it.each(['', 'a/b', 'a\\b', 'x'.repeat(129)])('rejects malformed UID %s', uid => {
    expect(() => resolveVerifiedTenantContext({uid})).toThrow();
  });
  it.each([{tenantId:'a'}, {firebase:{tenant:'b'}}])('refuses tenant claims %j', claims => {
    expect(() => resolveVerifiedTenantContext({uid:'owner', ...claims})).toThrow('unsupported_tenant');
  });
});

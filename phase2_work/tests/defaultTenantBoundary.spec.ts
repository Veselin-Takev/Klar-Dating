import { describe, it, expect } from 'vitest';
import { assertDefaultTenantClaims } from '../src/lib/defaultTenantBoundary';
describe('UID-rooted default tenant containment', () => {
  it('accepts the default Firebase namespace', () => {
    expect(() => assertDefaultTenantClaims({ uid: 'same-owner', firebase: {sign_in_provider: 'password'} })).not.toThrow();
  });
  it.each([{firebase: {tenant: 'a'}}, {firebase: {tenant: 'b'}}, {tenantId: 'a'}, {tenant_id: 'b'}, {tenantId: null}, {firebase: {tenant: ''}}, {firebase: []}])('rejects ambiguous or unsupported tenant claims %j', claims => {
    expect(() => assertDefaultTenantClaims({uid: 'same-owner', ...claims})).toThrow('unsupported_tenant');
  });
});

/** UID-rooted resources support only the default Firebase tenant until migration. */
export function assertDefaultTenantClaims(claims: unknown): void {
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) throw new Error('invalid_auth_claims');
  const data = claims as Record<string, unknown>;
  const firebase = data.firebase;
  if (Object.hasOwn(data, 'tenantId') || Object.hasOwn(data, 'tenant_id')
      || (firebase !== undefined && (!firebase || typeof firebase !== 'object' || Array.isArray(firebase)))
      || (firebase && typeof firebase === 'object' && Object.hasOwn(firebase, 'tenant'))) {
    throw new Error('unsupported_tenant');
  }
}

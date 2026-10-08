import { describe, expect, it } from 'vitest';
import { auditCloudRunService, auditMonitoring, auditProjectRoles, auditSecretPolicies } from '../src/server/platform/productionControls';

const sa = 'klar-runtime@klar-prod.iam.gserviceaccount.com';

describe('production control audit', () => {
  it('accepts explicit runtime identity and Secret Manager references', () => {
    const result = auditCloudRunService({
      expectedServiceAccount: sa,
      requiredSecrets: ['STRIPE_SECRET_KEY'],
      service: { spec: { template: { spec: {
        serviceAccountName: sa,
        containers: [{ env: [{ name: 'STRIPE_SECRET_KEY', valueFrom: { secretKeyRef: { name: 'stripe-secret' } } }] }],
      } } } },
    });
    expect(result.passed).toBe(true);
  });

  it('rejects plaintext secrets and unexpected runtime identity', () => {
    const result = auditCloudRunService({
      expectedServiceAccount: sa,
      requiredSecrets: ['STRIPE_SECRET_KEY'],
      service: { spec: { template: { spec: {
        serviceAccountName: '123-compute@developer.gserviceaccount.com',
        containers: [{ env: [{ name: 'STRIPE_SECRET_KEY', value: 'plaintext' }] }],
      } } } },
    });
    expect(result.passed).toBe(false);
    expect(result.errors.join(' ')).toMatch(/plaintext|service account/i);
  });

  it('rejects primitive owner/editor roles on the runtime service account', () => {
    expect(auditProjectRoles({ bindings: [{ role: 'roles/editor', members: ['serviceAccount:' + sa] }] }, sa).passed).toBe(false);
    expect(auditProjectRoles({ bindings: [{ role: 'roles/logging.logWriter', members: ['serviceAccount:' + sa] }] }, sa).passed).toBe(true);
  });

  it('requires secret accessor bindings on each declared secret', () => {
    expect(auditSecretPolicies({
      stripe: { bindings: [{ role: 'roles/secretmanager.secretAccessor', members: ['serviceAccount:' + sa] }] },
    }, sa, ['stripe']).passed).toBe(true);
    expect(auditSecretPolicies({ stripe: { bindings: [] } }, sa, ['stripe']).passed).toBe(false);
  });

  it('requires verified notification channels and named enabled policies', () => {
    expect(auditMonitoring(
      [{ displayName: 'Klar API burn rate 1h', enabled: true }],
      [{ enabled: true, verificationStatus: 'VERIFIED' }],
      ['Klar API burn rate 1h'],
    ).passed).toBe(true);
    expect(auditMonitoring([], [{ enabled: true, verificationStatus: 'UNVERIFIED' }], ['Klar API burn rate 1h']).passed).toBe(false);
  });
});

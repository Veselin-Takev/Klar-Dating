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

  it('resolves a Cloud Run secret alias to the actual Secret Manager resource', () => {
    const resource = 'projects/123456789/secrets/stripe-live-key';
    const result = auditCloudRunService({
      expectedServiceAccount: sa,
      requiredSecrets: ['STRIPE_SECRET_KEY'],
      service: { spec: { template: {
        metadata: { annotations: { 'run.googleapis.com/secrets': 'stripe-alias:' + resource } },
        spec: { serviceAccountName: sa, containers: [
          { env: [{ name: 'STRIPE_SECRET_KEY', valueFrom: { secretKeyRef: { name: 'stripe-alias', key: 'latest' } } }] },
        ] },
      } } },
    });
    expect(result.passed).toBe(true);
    expect(result.secretReferences).toEqual({ STRIPE_SECRET_KEY: resource });
  });

  it('rejects ambiguous duplicate required env vars across containers', () => {
    const result = auditCloudRunService({
      expectedServiceAccount: sa,
      requiredSecrets: ['STRIPE_SECRET_KEY'],
      service: { spec: { template: { spec: { serviceAccountName: sa, containers: [
        { env: [{ name: 'STRIPE_SECRET_KEY', value: 'plaintext' }] },
        { env: [{ name: 'STRIPE_SECRET_KEY', valueFrom: { secretKeyRef: { name: 'safe-alias' } } }] },
      ] } } } },
    });
    expect(result.passed).toBe(false);
    expect(result.errors.join(' ')).toMatch(/duplicate|multiple|ambiguous/i);
  });

  it('rejects malformed and conflicting Cloud Run secret aliases', () => {
    for (const annotation of [
      'alias:projects/prod/secrets/real,alias:projects/prod/secrets/other',
      'alias:projects/prod/secrets/real,bad-record',
      'alias:projects/prod/secrets/real,alias:projects/prod/secrets/real',
    ]) {
      const result = auditCloudRunService({
        expectedServiceAccount: sa,
        requiredSecrets: ['STRIPE_SECRET_KEY'],
        service: { spec: { template: {
          metadata: { annotations: { 'run.googleapis.com/secrets': annotation } },
          spec: { serviceAccountName: sa, containers: [
            { env: [{ name: 'STRIPE_SECRET_KEY', valueFrom: { secretKeyRef: { name: 'alias' } } }] },
          ] },
        } } },
      });
      expect(result.passed).toBe(false);
    }
  });

  it('rejects invalid secret reference names and does not return them for IAM lookup', () => {
    const result = auditCloudRunService({
      expectedServiceAccount: sa,
      requiredSecrets: ['STRIPE_SECRET_KEY'],
      service: { spec: { template: { spec: { serviceAccountName: sa, containers: [
        { env: [{ name: 'STRIPE_SECRET_KEY', valueFrom: { secretKeyRef: { name: '../unapproved' } } }] },
      ] } } } },
    });
    expect(result.passed).toBe(false);
    expect(result.secretReferences).toEqual({});
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

  it('does not count conditional Secret Manager grants as guaranteed workload access', () => {
    const grant = { role: 'roles/secretmanager.secretAccessor', members: ['serviceAccount:' + sa] };
    const conditional = { ...grant, condition: { title: 'expired', expression: 'request.time < timestamp("2020-01-01T00:00:00Z")' } };
    expect(auditSecretPolicies({ stripe: { bindings: [conditional] } }, sa, ['stripe']).passed).toBe(false);
    expect(auditSecretPolicies({ stripe: { bindings: [conditional, grant] } }, sa, ['stripe']).passed).toBe(true);
  });

  it('requires verified notification channels and named enabled policies', () => {
    expect(auditMonitoring(
      [{ displayName: 'Klar API burn rate 1h', enabled: true, notificationChannels: ['projects/p/notificationChannels/pager'] }],
      [{ name: 'projects/p/notificationChannels/pager', enabled: true, verificationStatus: 'VERIFIED' }],
      ['Klar API burn rate 1h'],
    ).passed).toBe(true);
    expect(auditMonitoring([], [{ enabled: true, verificationStatus: 'UNVERIFIED' }], ['Klar API burn rate 1h']).passed).toBe(false);
  });
  it('rejects unrelated global notification channels not attached to the required policy', () => {
    const policy = [{ displayName: 'Klar API burn rate 1h', enabled: true, notificationChannels: ['projects/p/notificationChannels/missing'] }];
    const channels = [{ name: 'projects/p/notificationChannels/pager', enabled: true, verificationStatus: 'VERIFIED' }];
    expect(auditMonitoring(policy, channels, ['Klar API burn rate 1h']).passed).toBe(false);
  });

  it('rejects unknown verification, missing channel identity, and disabled channels', () => {
    const policy = [{ displayName: 'Klar API burn rate 1h', enabled: true, notificationChannels: ['projects/p/notificationChannels/pager'] }];
    for (const channel of [
      { name: 'projects/p/notificationChannels/pager', enabled: true },
      { name: 'projects/p/notificationChannels/pager', enabled: true, verificationStatus: 'UNVERIFIED' },
      { name: 'projects/p/notificationChannels/pager', enabled: false, verificationStatus: 'VERIFIED' },
      { enabled: true, verificationStatus: 'VERIFIED' },
    ]) {
      expect(auditMonitoring(policy, [channel], ['Klar API burn rate 1h']).passed).toBe(false);
    }
  });

  it('rejects policies without explicitly enabled status or with invalid configuration', () => {
    const channels = [{ name: 'projects/p/notificationChannels/pager', enabled: true, verificationStatus: 'VERIFIED' }];
    for (const policy of [
      { displayName: 'Klar API burn rate 1h', notificationChannels: ['projects/p/notificationChannels/pager'] },
      { displayName: 'Klar API burn rate 1h', enabled: false, notificationChannels: ['projects/p/notificationChannels/pager'] },
      { displayName: 'Klar API burn rate 1h', enabled: true, validity: { code: 3 }, notificationChannels: ['projects/p/notificationChannels/pager'] },
      { displayName: 'Klar API burn rate 1h', enabled: true },
    ]) {
      expect(auditMonitoring([policy], channels, ['Klar API burn rate 1h']).passed).toBe(false);
    }
  });

});

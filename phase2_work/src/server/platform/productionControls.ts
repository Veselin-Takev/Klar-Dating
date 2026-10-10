export type CloudRunAuditInput = {
  service: unknown;
  expectedServiceAccount: string;
  requiredSecrets: string[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function auditCloudRunService(input: CloudRunAuditInput) {
  if (!isRecord(input.service)) throw new Error('Invalid Cloud Run service JSON');

  const serviceSpec = isRecord(input.service.spec) ? input.service.spec : {};
  const template = isRecord(serviceSpec.template) ? serviceSpec.template : {};
  const spec = isRecord(template.spec) ? template.spec : {};
  const containers = records(spec.containers);
  const serviceAccount = typeof spec.serviceAccountName === 'string' ? spec.serviceAccountName : '';
  const errors: string[] = [];

  if (!serviceAccount) errors.push('Cloud Run service account is missing');
  if (serviceAccount !== input.expectedServiceAccount) errors.push('Cloud Run service account does not match KLAR_EXPECTED_SERVICE_ACCOUNT');
  if (/^(default|\d+-compute@developer\.gserviceaccount\.com$)/.test(serviceAccount)) {
    errors.push('Default compute/runtime service account is not allowed');
  }

  const env = containers.flatMap(container => records(container.env));
  const byName = new Map(
    env
      .filter(item => typeof item.name === 'string')
      .map(item => [item.name as string, item]),
  );

  for (const secret of input.requiredSecrets) {
    const item = byName.get(secret);
    if (!item) {
      errors.push('Required secret env is missing: ' + secret);
      continue;
    }
    if ('value' in item && item.value != null) errors.push('Secret must not be configured as plaintext: ' + secret);
    const valueFrom = isRecord(item.valueFrom) ? item.valueFrom : {};
    const secretKeyRef = isRecord(valueFrom.secretKeyRef) ? valueFrom.secretKeyRef : {};
    if (typeof secretKeyRef.name !== 'string' || !secretKeyRef.name) {
      errors.push('Secret Manager reference is missing: ' + secret);
    }
  }

  return { serviceAccount, requiredSecrets: input.requiredSecrets, passed: errors.length === 0, errors };
}

export function auditProjectRoles(policy: unknown, serviceAccount: string) {
  const member = 'serviceAccount:' + serviceAccount;
  const bindings = records(isRecord(policy) ? policy.bindings : undefined);
  const roles = bindings
    .filter(binding => Array.isArray(binding.members) && binding.members.includes(member))
    .map(binding => typeof binding.role === 'string' ? binding.role : '')
    .filter(Boolean);
  const errors: string[] = [];
  for (const forbidden of ['roles/owner', 'roles/editor']) {
    if (roles.includes(forbidden)) errors.push('Runtime service account has forbidden primitive role: ' + forbidden);
  }
  return { roles, passed: errors.length === 0, errors };
}

export function auditSecretPolicies(
  policies: Record<string, unknown>,
  serviceAccount: string,
  requiredSecrets: string[],
) {
  const errors: string[] = [];
  const member = 'serviceAccount:' + serviceAccount;
  for (const secret of requiredSecrets) {
    const secretPolicy = isRecord(policies[secret]) ? policies[secret] : {};
    const bindings = records(secretPolicy.bindings);
    const accessor = bindings.some(binding =>
      binding.role === 'roles/secretmanager.secretAccessor' &&
      Array.isArray(binding.members) &&
      binding.members.includes(member),
    );
    if (!accessor) errors.push('Secret accessor binding missing for: ' + secret);
  }
  return { passed: errors.length === 0, errors };
}

export function auditMonitoring(policies: unknown, channels: unknown, requiredPolicyNames: string[]) {
  const policyList = records(policies);
  const channelList = records(channels);
  // Only explicit verification proves the stated production control. Channels
  // without a resource name cannot be correlated with an alert policy.
  const enabledChannels = channelList.filter(channel =>
    channel.enabled !== false &&
    channel.verificationStatus === 'VERIFIED' &&
    typeof channel.name === 'string' && channel.name.length > 0,
  );
  const channelNames = new Set(enabledChannels.map(channel => channel.name));
  // Cloud Monitoring list/get results populate enabled; missing state is not
  // evidence that a required policy can trigger notifications.
  const usablePolicies = policyList.filter(policy =>
    policy.enabled === true && policy.validity == null,
  );
  const enabledPolicyNames = usablePolicies
    .map(policy => typeof policy.displayName === 'string' ? policy.displayName : '');
  const errors: string[] = [];
  if (!enabledChannels.length) errors.push('No explicitly verified, enabled monitoring notification channel found');
  for (const name of requiredPolicyNames) {
    const policies = usablePolicies.filter(policy => policy.displayName === name);
    if (!policies.length) {
      errors.push('Required enabled and valid alert policy is missing: ' + name);
      continue;
    }
    if (!policies.some(policy =>
      Array.isArray(policy.notificationChannels) &&
      policy.notificationChannels.some(channel => typeof channel === 'string' && channelNames.has(channel)),
    )) {
      errors.push('Required alert policy has no linked enabled/verified notification channel: ' + name);
    }
  }
  return { enabledChannelCount: enabledChannels.length, enabledPolicyNames, passed: errors.length === 0, errors };
}

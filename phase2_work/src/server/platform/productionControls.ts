export type CloudRunAuditInput = {
  service: unknown;
  expectedServiceAccount: string;
  requiredSecrets: string[];
};

type EnvEntry = { name?: string; value?: unknown; valueFrom?: { secretKeyRef?: { name?: string } } };

export function auditCloudRunService(input: CloudRunAuditInput) {
  if (!input.service || typeof input.service !== 'object') throw new Error('Invalid Cloud Run service JSON');
  const service = input.service as unknown;
  const spec = service?.spec?.template?.spec;
  const containers = Array.isArray(spec?.containers) ? spec.containers : [];
  const serviceAccount = String(spec?.serviceAccountName ?? '');
  const errors: string[] = [];

  if (!serviceAccount) errors.push('Cloud Run service account is missing');
  if (serviceAccount !== input.expectedServiceAccount) {
    errors.push('Cloud Run service account does not match KLAR_EXPECTED_SERVICE_ACCOUNT');
  }
  if (/^(default|\d+-compute@developer\.gserviceaccount\.com$)/.test(serviceAccount)) {
    errors.push('Default compute/runtime service account is not allowed');
  }

  const env: EnvEntry[] = containers.flatMap((container: unknown) => Array.isArray(container?.env) ? container.env : []);
  const byName = new Map(env.filter(item => item?.name).map(item => [String(item.name), item]));
  for (const secret of input.requiredSecrets) {
    const item = byName.get(secret);
    if (!item) {
      errors.push('Required secret env is missing: ' + secret);
      continue;
    }
    if ('value' in item && item.value != null) errors.push('Secret must not be configured as plaintext: ' + secret);
    if (!item.valueFrom?.secretKeyRef?.name) errors.push('Secret Manager reference is missing: ' + secret);
  }

  return { serviceAccount, requiredSecrets: input.requiredSecrets, passed: errors.length === 0, errors };
}

export function auditProjectRoles(policy: unknown, serviceAccount: string) {
  const errors: string[] = [];
  const bindings = Array.isArray((policy as unknown)?.bindings) ? (policy as unknown).bindings : [];
  const member = 'serviceAccount:' + serviceAccount;
  const roles = bindings
    .filter((binding: unknown) => Array.isArray(binding?.members) && binding.members.includes(member))
    .map((binding: unknown) => String(binding.role ?? ''))
    .filter(Boolean);
  for (const forbidden of ['roles/owner', 'roles/editor']) {
    if (roles.includes(forbidden)) errors.push('Runtime service account has forbidden primitive role: ' + forbidden);
  }
  return { roles, passed: errors.length === 0, errors };
}

export function auditSecretPolicies(policies: Record<string, unknown>, serviceAccount: string, requiredSecrets: string[]) {
  const errors: string[] = [];
  const member = 'serviceAccount:' + serviceAccount;
  for (const secret of requiredSecrets) {
    const bindings = Array.isArray((policies[secret] as unknown)?.bindings) ? (policies[secret] as unknown).bindings : [];
    const accessor = bindings.some((binding: unknown) =>
      binding?.role === 'roles/secretmanager.secretAccessor' && Array.isArray(binding.members) && binding.members.includes(member),
    );
    if (!accessor) errors.push('Secret accessor binding missing for: ' + secret);
  }
  return { passed: errors.length === 0, errors };
}

export function auditMonitoring(policies: unknown, channels: unknown, requiredPolicyNames: string[]) {
  const policyList = Array.isArray(policies) ? policies : [];
  const channelList = Array.isArray(channels) ? channels : [];
  const enabledChannels = channelList.filter((channel: unknown) => channel?.enabled !== false && channel?.verificationStatus !== 'UNVERIFIED');
  const enabledPolicyNames = policyList
    .filter((policy: unknown) => policy?.enabled !== false)
    .map((policy: unknown) => String(policy?.displayName ?? ''));
  const errors: string[] = [];
  if (!enabledChannels.length) errors.push('No enabled/verified monitoring notification channel found');
  for (const name of requiredPolicyNames) {
    if (!enabledPolicyNames.includes(name)) errors.push('Required enabled alert policy is missing: ' + name);
  }
  return { enabledChannelCount: enabledChannels.length, enabledPolicyNames, passed: errors.length === 0, errors };
}

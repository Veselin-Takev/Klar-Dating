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
  const containerCount = Array.isArray(spec.containers) ? spec.containers.length : 0;
  const serviceAccount = typeof spec.serviceAccountName === 'string' ? spec.serviceAccountName : '';
  const errors: string[] = [];
  if (containerCount === 0) errors.push('Cloud Run service has no containers');
  if (containers.length !== containerCount) errors.push('Cloud Run service contains malformed container records');

  if (!serviceAccount) errors.push('Cloud Run service account is missing');
  if (serviceAccount !== input.expectedServiceAccount) errors.push('Cloud Run service account does not match KLAR_EXPECTED_SERVICE_ACCOUNT');
  if (/^(default|\d+-compute@developer\.gserviceaccount\.com$)/.test(serviceAccount)) {
    errors.push('Default compute/runtime service account is not allowed');
  }

  // In Cloud Run v1, secretKeyRef.name may be a template-local alias. The
  // run.googleapis.com/secrets annotation resolves the alias to its *actual*
  // Secret Manager resource (which can belong to another project).
  const metadata = isRecord(template.metadata) ? template.metadata : {};
  const annotations = isRecord(metadata.annotations) ? metadata.annotations : {};
  const rawAliases = annotations['run.googleapis.com/secrets'];
  const aliases = new Map<string, string>();
  const bareSecret = /^[A-Za-z0-9_-]{1,255}$/;
  const resourceSecret = /^projects\/[A-Za-z0-9][A-Za-z0-9._-]*\/secrets\/[A-Za-z0-9_-]{1,255}$/;
  if (rawAliases !== undefined) {
    if (typeof rawAliases !== 'string' || !rawAliases.trim()) {
      errors.push('Cloud Run Secret Manager alias annotation is invalid');
    } else {
      for (const entry of rawAliases.split(',')) {
        const separator = entry.indexOf(':');
        const alias = separator >= 0 ? entry.slice(0, separator).trim() : '';
        const resource = separator >= 0 ? entry.slice(separator + 1).trim() : '';
        if (!bareSecret.test(alias) || !resourceSecret.test(resource) || aliases.has(alias)) {
          errors.push('Cloud Run Secret Manager alias annotation contains invalid or duplicate entries');
        } else {
          aliases.set(alias, resource);
        }
      }
    }
  }

  // Flattening into a Map would hide a plaintext or conflicting definition in
  // another container. Any duplicate required env variable is ambiguous.
  for (const container of containers) {
    if (container.env !== undefined && (!Array.isArray(container.env) || records(container.env).length !== container.env.length)) {
      errors.push('Cloud Run container contains malformed env records');
    }
  }
  const env = containers.flatMap(container => records(container.env));
  const secretReferences: Record<string, string> = Object.create(null);
  for (const secret of input.requiredSecrets) {
    const entries = env.filter(item => item.name === secret);
    if (!entries.length) {
      errors.push('Required secret env is missing: ' + secret);
      continue;
    }
    if (entries.length !== 1) {
      errors.push('Required secret env has ambiguous duplicate definitions: ' + secret);
      continue;
    }
    const item = entries[0];
    if (!item) {
      errors.push('Required secret env is missing: ' + secret);
      continue;
    }
    if ('value' in item) errors.push('Secret must not define a plaintext value field: ' + secret);
    const valueFrom = isRecord(item.valueFrom) ? item.valueFrom : {};
    const secretKeyRef = isRecord(valueFrom.secretKeyRef) ? valueFrom.secretKeyRef : {};
    const refName = secretKeyRef.name;
    if (typeof refName !== 'string' || !bareSecret.test(refName) && !resourceSecret.test(refName)) {
      errors.push('Secret Manager reference is missing or invalid: ' + secret);
      continue;
    }
    // Resolve real resources, not environment variable names or alias strings.
    secretReferences[secret] = aliases.get(refName) ?? refName;
  }

  return { serviceAccount, requiredSecrets: input.requiredSecrets, secretReferences, passed: errors.length === 0, errors };
}

export function auditProjectRoles(policy: unknown, serviceAccount: string) {
  const member = 'serviceAccount:' + serviceAccount;
  const bindings = records(isRecord(policy) ? policy.bindings : undefined);
  const roles = bindings
    .filter(binding => Array.isArray(binding.members) && binding.members.includes(member))
    .map(binding => typeof binding.role === 'string' ? binding.role : '')
    .filter(Boolean);
  const errors: string[] = [];
  if (!isRecord(policy) || !Array.isArray(policy.bindings)) {
    errors.push('Project IAM policy bindings are missing or malformed');
  } else if (records(policy.bindings).length !== policy.bindings.length ||
    records(policy.bindings).some(binding => typeof binding.role !== 'string' || !Array.isArray(binding.members) ||
      !binding.members.every(member => typeof member === 'string'))) {
    errors.push('Project IAM policy contains malformed binding records');
  }
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
    if (!Array.isArray(secretPolicy.bindings) || records(secretPolicy.bindings).length !== secretPolicy.bindings.length ||
      records(secretPolicy.bindings).some(binding => typeof binding.role !== 'string' || !Array.isArray(binding.members) ||
        !binding.members.every(member => typeof member === 'string'))) {
      errors.push('Secret IAM policy bindings are missing or malformed for: ' + secret);
      continue;
    }
    const bindings = records(secretPolicy.bindings);
    const accessor = bindings.some(binding =>
      binding.role === 'roles/secretmanager.secretAccessor' &&
      binding.condition == null &&
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
    channel.enabled === true &&
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
  if (!Array.isArray(policies) || policyList.length !== policies.length) {
    errors.push('Monitoring alert policy list is missing or contains malformed records');
  }
  if (!Array.isArray(channels) || channelList.length !== channels.length) {
    errors.push('Monitoring notification channel list is missing or contains malformed records');
  }
  if (requiredPolicyNames.length === 0 || requiredPolicyNames.some(name => typeof name !== 'string' || !name.trim())) {
    errors.push('Required monitoring alert policy names are missing or invalid');
  }
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

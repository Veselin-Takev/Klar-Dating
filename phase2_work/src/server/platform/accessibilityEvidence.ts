export type AccessibilityCheckStatus = 'pass' | 'fail' | 'not_tested';

export type AccessibilityManualEvidence = {
  schemaVersion: 2;
  standard: 'WCAG 2.2 AA';
  buildSha: string;
  environment: 'staging' | 'production';
  evaluatedAt: string;
  scope: { product: string; environments: string[]; flows: string[] };
  reviewer: { name: string; role: string };
  implementer?: { name: string };
  checks: Array<{
    area: 'keyboard' | 'screen_reader' | 'reflow_zoom' | 'visual' | 'motion' | 'input' | 'cognitive';
    status: AccessibilityCheckStatus;
    environments: string[];
    notes: string;
    evidenceLinks: string[];
  }>;
  findings: Array<{
    id: string;
    severity: 'blocker' | 'high' | 'medium' | 'low';
    status: 'open' | 'fixed' | 'accepted';
    description: string;
  }>;
  conclusion: 'pass' | 'fail' | 'incomplete';
};

const requiredAreas = [
  'keyboard', 'screen_reader', 'reflow_zoom', 'visual', 'motion', 'input', 'cognitive',
] as const;

export function validateAccessibilityManualEvidence(value: unknown, expectedBuildSha: string, expectedEnvironment: AccessibilityManualEvidence['environment'], approvedEvidenceHosts: string[], evidenceNotBefore: string, evidenceNotAfter: string) {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return { passed: false, errors: ['Evidence must be an object'] };
  const evidence = value as Partial<AccessibilityManualEvidence>;

  if (evidence.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  if (evidence.standard !== 'WCAG 2.2 AA') errors.push('standard must be WCAG 2.2 AA');
  if (!['staging', 'production'].includes(String(evidence.environment ?? ''))) errors.push('environment must be staging or production');
  if (!['staging', 'production'].includes(expectedEnvironment)) errors.push('expectedEnvironment must be staging or production');
  else if (evidence.environment !== expectedEnvironment) errors.push('environment must match the trusted evaluation environment');
  if (!/^[0-9a-f]{40}$/.test(String(evidence.buildSha ?? ''))) errors.push('buildSha must be a full 40-character lowercase Git SHA');
  if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) errors.push('expectedBuildSha must be a full 40-character lowercase Git SHA');
  else if (evidence.buildSha !== expectedBuildSha) errors.push('buildSha must match the exact evaluated build');
  const evaluatedMs = Date.parse(String(evidence.evaluatedAt ?? ''));
  const notBeforeMs = Date.parse(evidenceNotBefore);
  const notAfterMs = Date.parse(evidenceNotAfter);
  if (!evidence.evaluatedAt || !Number.isFinite(evaluatedMs)) errors.push('evaluatedAt must be an ISO date/time');
  if (!Number.isFinite(notBeforeMs)) errors.push('evidenceNotBefore must be a valid ISO date/time');
  if (!Number.isFinite(notAfterMs)) errors.push('evidenceNotAfter must be a valid ISO date/time');
  if (Number.isFinite(evaluatedMs) && Number.isFinite(notBeforeMs) && evaluatedMs < notBeforeMs) errors.push('evaluatedAt must not predate evidenceNotBefore');
  if (Number.isFinite(evaluatedMs) && Number.isFinite(notAfterMs) && evaluatedMs > notAfterMs) errors.push('evaluatedAt must not be after evidenceNotAfter');

  const scope = evidence.scope;
  if (!scope?.product?.trim()) errors.push('scope.product is required');
  if (!Array.isArray(scope?.environments) || scope.environments.length === 0) errors.push('scope.environments must not be empty');
  if (!Array.isArray(scope?.flows) || scope.flows.length === 0) errors.push('scope.flows must not be empty');

  if (!evidence.reviewer?.name?.trim() || !evidence.reviewer?.role?.trim()) errors.push('reviewer name and role are required');
  if (evidence.implementer?.name && evidence.reviewer?.name && evidence.implementer.name.trim() === evidence.reviewer.name.trim()) {
    errors.push('critical-journey reviewer must be independent from the implementer');
  }

  const approvedHosts = new Set(approvedEvidenceHosts.map(host => host.trim().toLowerCase()).filter(Boolean));
  if (approvedHosts.size === 0) errors.push('at least one approved evidence host is required');

  const checks = Array.isArray(evidence.checks) ? evidence.checks : [];
  const checkByArea = new Map(checks.map(check => [check.area, check]));
  for (const area of requiredAreas) {
    const check = checkByArea.get(area);
    if (!check) { errors.push('missing manual check area: ' + area); continue; }
    if (check.status !== 'pass') errors.push('manual check must pass before release: ' + area);
    if (!Array.isArray(check.environments) || check.environments.length === 0) errors.push('manual check environments missing: ' + area);
    for (const link of check.evidenceLinks ?? []) {
      try {
        const url = new URL(link);
        if (url.protocol !== 'https:') errors.push('accessibility evidence links must use https: ' + link);
        else if (!approvedHosts.has(url.hostname.toLowerCase())) errors.push('accessibility evidence link host is not an approved evidence source: ' + url.hostname);
      } catch { errors.push('accessibility evidence link is invalid: ' + link); }
    }
    if (!check.notes?.trim()) errors.push('manual check notes missing: ' + area);
    if (!Array.isArray(check.evidenceLinks) || check.evidenceLinks.length === 0) errors.push('manual check evidence link missing: ' + area);
  }

  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  for (const finding of findings) {
    if (!finding.id?.trim() || !finding.description?.trim()) errors.push('findings require id and description');
    if ((finding.severity === 'blocker' || finding.severity === 'high') && finding.status !== 'fixed') {
      errors.push('open/accepted blocker or high finding prevents release: ' + (finding.id || 'unknown'));
    }
  }

  if (evidence.conclusion !== 'pass') errors.push('conclusion must be pass before release');

  return { passed: errors.length === 0, errors };
}

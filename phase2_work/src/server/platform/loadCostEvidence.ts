export type ProductionLoadCostEvidence = {
  schemaVersion: 2;
  buildSha: string;
  environment: 'staging' | 'production';
  measuredAt: string;
  loadReportPath: string;
  billingSource: {
    name: string;
    evidenceLinks: string[];
  };
  approvedBudget: {
    maxCostPer1000RequestsUsd: number;
    approvedBy: string;
    approvedAt: string;
    rationale: string;
  };
  cost: {
    totalCostUsd: number;
    requestCount: number;
    costPer1000RequestsUsd: number;
  };
};

type LoadReport = {
  schemaVersion?: unknown;
  generatedAt?: unknown;
  buildSha?: unknown;
  measurements?: { total?: unknown };
  verdict?: { passed?: unknown };
};

export function validateProductionLoadCostEvidence(evidenceValue: unknown, loadValue: unknown, expectedBuildSha: string, expectedEnvironment: ProductionLoadCostEvidence['environment'], approvedEvidenceHosts: string[], evidenceNotBefore: string, evidenceNotAfter: string, approvedMaxCostPer1000RequestsUsd: number) {
  const errors: string[] = [];
  if (!evidenceValue || typeof evidenceValue !== 'object') return { passed: false, errors: ['Evidence must be an object'] };
  if (!loadValue || typeof loadValue !== 'object') return { passed: false, errors: ['Load report must be an object'] };

  const evidence = evidenceValue as Partial<ProductionLoadCostEvidence>;
  const load = loadValue as LoadReport;

  if (evidence.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  if (!/^[0-9a-f]{40}$/.test(String(evidence.buildSha ?? ''))) errors.push('buildSha must be a full 40-character lowercase Git SHA');
  if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) errors.push('expectedBuildSha must be a full 40-character lowercase Git SHA');
  else if (evidence.buildSha !== expectedBuildSha) errors.push('buildSha must match the exact evaluated build');
  if (!['staging','production'].includes(String(evidence.environment ?? ''))) errors.push('environment must be staging or production');
  if (!['staging','production'].includes(expectedEnvironment)) errors.push('expectedEnvironment must be staging or production');
  else if (evidence.environment !== expectedEnvironment) errors.push('environment must match the trusted evaluation environment');
  const measuredMs = Date.parse(String(evidence.measuredAt ?? ''));
  const notBeforeMs = Date.parse(evidenceNotBefore);
  const notAfterMs = Date.parse(evidenceNotAfter);
  if (!evidence.measuredAt || !Number.isFinite(measuredMs)) errors.push('measuredAt must be an ISO date/time');
  if (!Number.isFinite(notBeforeMs)) errors.push('evidenceNotBefore must be a valid ISO date/time');
  if (!Number.isFinite(notAfterMs)) errors.push('evidenceNotAfter must be a valid ISO date/time');
  if (Number.isFinite(measuredMs) && Number.isFinite(notBeforeMs) && measuredMs < notBeforeMs) errors.push('measuredAt must not predate evidenceNotBefore');
  if (Number.isFinite(measuredMs) && Number.isFinite(notAfterMs) && measuredMs > notAfterMs) errors.push('measuredAt must not be after evidenceNotAfter');
  if (!evidence.loadReportPath?.trim()) errors.push('loadReportPath is required');

  const loadGeneratedMs = Date.parse(String(load.generatedAt ?? ''));
  if (load.verdict?.passed !== true) errors.push('referenced load report must have verdict.passed=true');
  if (!Number.isFinite(loadGeneratedMs)) errors.push('load report generatedAt must be an ISO date/time');
  else if (Number.isFinite(measuredMs) && loadGeneratedMs > measuredMs) errors.push('load report generatedAt cannot be after measuredAt');
  if (load.buildSha !== evidence.buildSha) errors.push('load report buildSha must match evidence buildSha');
  const loadTotal = Number(load.measurements?.total);
  if (!Number.isInteger(loadTotal) || loadTotal <= 0) errors.push('load report measurements.total must be a positive integer');

  if (!evidence.billingSource?.name?.trim()) errors.push('billingSource.name is required');
  if (!Array.isArray(evidence.billingSource?.evidenceLinks) || evidence.billingSource.evidenceLinks.length === 0) {
    errors.push('at least one billingSource evidence link is required');
  }
  const approvedHosts = new Set(approvedEvidenceHosts.map(host => host.trim().toLowerCase()).filter(Boolean));
  if (approvedHosts.size === 0) errors.push('at least one approved evidence host is required');
  for (const link of evidence.billingSource?.evidenceLinks ?? []) {
    try {
      const url = new URL(link);
      if (!['https:','gs:'].includes(url.protocol)) errors.push('billing evidence links must use https or gs');
      else if (url.protocol === 'https:' && !approvedHosts.has(url.hostname.toLowerCase())) errors.push('billing evidence link host is not an approved evidence source: ' + url.hostname);
      else if (url.protocol === 'gs:' && !approvedHosts.has(url.hostname.toLowerCase())) errors.push('billing evidence bucket is not an approved evidence source: ' + url.hostname);
    } catch { errors.push('billing evidence link is invalid: ' + link); }
  }

  const budget = evidence.approvedBudget ?? { maxCostPer1000RequestsUsd: NaN, approvedBy: '', approvedAt: '', rationale: '' };
  if (!Number.isFinite(approvedMaxCostPer1000RequestsUsd) || approvedMaxCostPer1000RequestsUsd <= 0) errors.push('approvedMaxCostPer1000RequestsUsd must be a positive trusted value');
  if (!Number.isFinite(budget?.maxCostPer1000RequestsUsd) || Number(budget?.maxCostPer1000RequestsUsd) <= 0) {
    errors.push('approvedBudget.maxCostPer1000RequestsUsd must be a positive approved value');
  } else if (Number.isFinite(approvedMaxCostPer1000RequestsUsd) && Number(budget.maxCostPer1000RequestsUsd) !== approvedMaxCostPer1000RequestsUsd) {
    errors.push('approvedBudget.maxCostPer1000RequestsUsd must match the trusted approved budget');
  }
  if (!budget?.approvedBy?.trim()) errors.push('approvedBudget.approvedBy is required');
  const budgetApprovedMs = Date.parse(String(budget?.approvedAt ?? ''));
  if (!budget?.approvedAt || Number.isNaN(budgetApprovedMs)) errors.push('approvedBudget.approvedAt must be an ISO date/time');
  else if (Number.isFinite(measuredMs) && budgetApprovedMs > measuredMs) errors.push('approvedBudget.approvedAt cannot be after measuredAt');
  if (!budget?.rationale?.trim()) errors.push('approvedBudget.rationale is required');

  const cost = evidence.cost;
  const totalCost = Number(cost?.totalCostUsd);
  const requestCount = Number(cost?.requestCount);
  const per1000 = Number(cost?.costPer1000RequestsUsd);
  if (!Number.isFinite(totalCost) || totalCost < 0) errors.push('cost.totalCostUsd must be a non-negative finite number');
  if (!Number.isInteger(requestCount) || requestCount <= 0) errors.push('cost.requestCount must be a positive integer');
  if (!Number.isFinite(per1000) || per1000 < 0) errors.push('cost.costPer1000RequestsUsd must be a non-negative finite number');

  if (Number.isInteger(requestCount) && requestCount > 0 && Number.isFinite(totalCost) && Number.isFinite(per1000)) {
    const expected = totalCost / requestCount * 1000;
    const tolerance = Math.max(0.000001, expected * 0.0001);
    if (Math.abs(expected - per1000) > tolerance) errors.push('costPer1000RequestsUsd does not match totalCostUsd/requestCount');
  }
  if (Number.isInteger(loadTotal) && loadTotal > 0 && requestCount !== loadTotal) {
    errors.push('cost.requestCount must equal load report measurements.total');
  }
  if (Number.isFinite(per1000) && Number.isFinite(approvedMaxCostPer1000RequestsUsd) && per1000 > approvedMaxCostPer1000RequestsUsd) {
    errors.push('measured unit cost exceeds the trusted approved budget');
  }

  return { passed: errors.length === 0, errors };
}

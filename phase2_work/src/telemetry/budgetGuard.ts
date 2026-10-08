export type BudgetDecision = 'ALLOW' | 'SOFT_CAP' | 'HARD_CAP';

export interface BudgetPolicy {
  monthlyBudget: number;
  softCapPercent: number;
  hardCapPercent: number;
  maxRequestsPerMinute?: number;
}
export interface BudgetState { tenantId: string; workflowId: string; spent: number; policy: BudgetPolicy; }

export function evaluateBudget(state: BudgetState): BudgetDecision {
  if (!state.tenantId || !state.workflowId || !Number.isFinite(state.spent) || state.spent < 0 || state.policy.monthlyBudget <= 0) {
    throw new Error('AI_INVALID_BUDGET_STATE');
  }
  const ratio = state.spent / state.policy.monthlyBudget * 100;
  if (ratio >= state.policy.hardCapPercent) return 'HARD_CAP';
  if (ratio >= state.policy.softCapPercent) return 'SOFT_CAP';
  return 'ALLOW';
}

export function assertBudgetAllowed(state: BudgetState): BudgetDecision {
  const decision = evaluateBudget(state);
  if (decision === 'HARD_CAP') throw new Error('AI_BUDGET_HARD_CAP');
  return decision;
}

export class BudgetGuard {
  private spent = new Map<string, number>();
  private requests = new Map<string, number[]>();

  constructor(private readonly policy: BudgetPolicy) {}

  reserve(tenantId: string, workflowId: string, estimatedCost: number, now = Date.now()): BudgetDecision {
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) throw new Error('AI_INVALID_COST');
    const key = `${tenantId}:${workflowId}`;
    const current = this.spent.get(key) ?? 0;
    const decision = evaluateBudget({ tenantId, workflowId, spent: current + estimatedCost, policy: this.policy });
    if (decision === 'HARD_CAP') throw new Error('AI_BUDGET_HARD_CAP');
    const timestamps = (this.requests.get(key) ?? []).filter((timestamp) => timestamp > now - 60_000);
    if (this.policy.maxRequestsPerMinute && timestamps.length >= this.policy.maxRequestsPerMinute) throw new Error('AI_RATE_LIMIT');
    timestamps.push(now);
    this.requests.set(key, timestamps);
    this.spent.set(key, current + estimatedCost);
    return decision;
  }

  currentSpend(tenantId: string, workflowId: string): number { return this.spent.get(`${tenantId}:${workflowId}`) ?? 0; }
  reset(): void { this.spent.clear(); this.requests.clear(); }
}

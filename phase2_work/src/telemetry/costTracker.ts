export interface TokenUsage {
  tenantId: string;
  workflowId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp?: number;
}

export interface CostRate { inputPerMillion: number; outputPerMillion: number; }

export interface CostSnapshot {
  tenantId: string;
  workflowId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  requests: number;
}

const DEFAULT_RATES: Record<string, CostRate> = {
  'gemini-3.8-flash': { inputPerMillion: 0.30, outputPerMillion: 2.50 },
  default: { inputPerMillion: 0.30, outputPerMillion: 2.50 },
};

export class CostTracker {
  private readonly records = new Map<string, CostSnapshot>();
  constructor(private readonly rates: Record<string, CostRate> = DEFAULT_RATES) {}

  record(usage: TokenUsage): CostSnapshot {
    if (!Number.isSafeInteger(usage.inputTokens) || usage.inputTokens < 0 || !Number.isSafeInteger(usage.outputTokens) || usage.outputTokens < 0) {
      throw new Error('AI_INVALID_TOKEN_USAGE');
    }
    if (!usage.tenantId || !usage.workflowId) throw new Error('AI_COST_SCOPE_REQUIRED');
    const key = `${usage.tenantId}:${usage.workflowId}`;
    const current = this.records.get(key) ?? { tenantId: usage.tenantId, workflowId: usage.workflowId, inputTokens: 0, outputTokens: 0, estimatedCost: 0, requests: 0 };
    const rate = this.rates[usage.model] ?? this.rates.default ?? { inputPerMillion: 0, outputPerMillion: 0 };
    current.inputTokens += usage.inputTokens;
    current.outputTokens += usage.outputTokens;
    current.estimatedCost += usage.inputTokens / 1_000_000 * rate.inputPerMillion + usage.outputTokens / 1_000_000 * rate.outputPerMillion;
    current.requests += 1;
    this.records.set(key, current);
    return { ...current };
  }

  snapshot(tenantId: string, workflowId?: string): CostSnapshot[] {
    return [...this.records.values()].filter((record) => record.tenantId === tenantId && (!workflowId || record.workflowId === workflowId)).map((record) => ({ ...record }));
  }

  reset(): void { this.records.clear(); }
}

export const costTracker = new CostTracker();

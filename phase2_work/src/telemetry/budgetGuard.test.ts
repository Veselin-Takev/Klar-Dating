import { describe, expect, it } from 'vitest';
import { assertBudgetAllowed, evaluateBudget } from './budgetGuard';

describe('budget guard', () => {
  const policy = { monthlyBudget: 100, softCapPercent: 80, hardCapPercent: 100 };
  it('soft caps at 80%', () => expect(evaluateBudget({ tenantId: 't', workflowId: 'w', spent: 80, policy })).toBe('SOFT_CAP'));
  it('hard caps at 100%', () => expect(() => assertBudgetAllowed({ tenantId: 't', workflowId: 'w', spent: 100, policy })).toThrow('AI_BUDGET_HARD_CAP'));
});

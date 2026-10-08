import { describe, expect, it, vi } from 'vitest';
import { AgentOrchestrator, type AgentRequest, type OrchestratorOptions } from './orchestrator';

describe('AgentOrchestrator', () => {
  const budget = { tenantId: 't', workflowId: 'w', spent: 1, policy: { monthlyBudget: 100, softCapPercent: 80, hardCapPercent: 100 } };
  it('routes high-risk work to human review before execution', async () => {
    const executeMock = vi.fn(async <T>(_request: AgentRequest<T>, payload: T): Promise<T> => payload);
    const execute = executeMock as unknown as OrchestratorOptions['execute'];
    const humanReview = vi.fn(async () => ({ status: 'human_review' as const, reason: 'approval required' }));
    const orchestrator = new AgentOrchestrator({ execute, humanReview });
    const result = await orchestrator.run({ principal: { id: 'a', tenantId: 't', role: 'agent_operator' }, action: 'write_ticket', risk: 'high', input: 'normal', payload: { text: 'normal' }, budget });
    expect(result.status).toBe('human_review');
    expect(executeMock).not.toHaveBeenCalled();
    expect(humanReview).toHaveBeenCalledTimes(1);
  });
});

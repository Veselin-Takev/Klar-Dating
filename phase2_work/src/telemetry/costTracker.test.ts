import { describe, expect, it } from 'vitest';
import { CostTracker } from './costTracker';

describe('CostTracker', () => {
  it('tracks tokens and deterministic estimated cost by tenant/workflow', () => {
    const tracker = new CostTracker({ test: { inputPerMillion: 1, outputPerMillion: 2 }, default: { inputPerMillion: 1, outputPerMillion: 2 } });
    const snapshot = tracker.record({ tenantId: 't1', workflowId: 'w1', model: 'test', inputTokens: 1_000_000, outputTokens: 500_000 });
    expect(snapshot.estimatedCost).toBe(2);
    expect(tracker.snapshot('t1', 'w1')[0]?.requests).toBe(1);
  });
});

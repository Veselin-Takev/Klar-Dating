import { describe, expect, it } from 'vitest';
import { isAgentActionAllowed } from './rbacControl';

describe('agent RBAC control', () => {
  const principal = { id: 'agent-1', tenantId: 'tenant-1', role: 'agent_operator' as const };
  it('allows bounded medium-risk workflow actions', () => expect(isAgentActionAllowed(principal, 'write_ticket', { risk: 'medium' })).toBe(true));
  it('requires human approval for high-risk actions', () => expect(isAgentActionAllowed(principal, 'financial_transaction', { risk: 'high' })).toBe(false));
});

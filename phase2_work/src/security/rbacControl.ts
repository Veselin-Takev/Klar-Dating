export type AiRole = 'viewer' | 'operator' | 'agent_operator' | 'admin';
export type AgentAction =
  | 'read_knowledge'
  | 'draft_response'
  | 'write_ticket'
  | 'send_external_message'
  | 'modify_customer_data'
  | 'financial_transaction'
  | 'change_permissions'
  | 'delete_data';

const ROLE_LEVEL: Record<AiRole, number> = { viewer: 0, operator: 1, agent_operator: 2, admin: 3 };
const ACTION_LEVEL: Record<AgentAction, number> = {
  read_knowledge: 0,
  draft_response: 1,
  write_ticket: 1,
  send_external_message: 2,
  modify_customer_data: 2,
  financial_transaction: 3,
  change_permissions: 3,
  delete_data: 3,
};

export interface AgentPrincipal { id: string; role: AiRole; tenantId: string; }
export interface AuthorizationContext { risk: 'low' | 'medium' | 'high'; humanApproved?: boolean; }

export function isAgentActionAllowed(principal: AgentPrincipal, action: AgentAction, context: AuthorizationContext): boolean {
  if (!principal.id || !principal.tenantId) return false;
  if (ROLE_LEVEL[principal.role] < ACTION_LEVEL[action]) return false;
  if (context.risk === 'high' && context.humanApproved !== true) return false;
  if (ACTION_LEVEL[action] >= 3 && context.humanApproved !== true) return false;
  return true;
}

export function assertAgentActionAllowed(principal: AgentPrincipal, action: AgentAction, context: AuthorizationContext): void {
  if (!isAgentActionAllowed(principal, action, context)) throw new Error('AI_AGENT_ACTION_FORBIDDEN');
}

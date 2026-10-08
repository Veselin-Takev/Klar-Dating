import { assertAgentActionAllowed, type AgentAction, type AgentPrincipal } from '../security/rbacControl';
import { evaluateInputGuardrails, evaluateOutputGuardrails } from '../middleware/guardrailMiddleware';
import { sanitizeProviderPayload } from '../security/piiSanitizer';
import { assertBudgetAllowed, type BudgetState } from '../telemetry/budgetGuard';

export type AgentRisk = 'low' | 'medium' | 'high';
export interface AgentRequest<T> {
  principal: AgentPrincipal;
  action: AgentAction;
  risk: AgentRisk;
  input: string;
  payload: T;
  budget: BudgetState;
  humanApproval?: boolean;
}
export interface AgentExecutionResult<T> { status: 'completed' | 'human_review'; value?: T; reason?: string; }

export interface OrchestratorOptions {
  execute: <T>(request: AgentRequest<T>, sanitizedPayload: T) => Promise<T>;
  humanReview: <T>(request: AgentRequest<T>) => Promise<AgentExecutionResult<T>>;
}

export class AgentOrchestrator {
  constructor(private readonly options: OrchestratorOptions) {}

  async run<T>(request: AgentRequest<T>): Promise<AgentExecutionResult<T>> {
    const inputGuard = evaluateInputGuardrails(request.input);
    if (!inputGuard.allowed) throw new Error(`AI_INPUT_GUARDRAIL:${inputGuard.reason}`);
    const budgetDecision = assertBudgetAllowed(request.budget);
    // First enforce role/action authority independent of the risk gate.
    // High-risk work then pauses for explicit human approval rather than being executed.
    assertAgentActionAllowed(request.principal, request.action, { risk: 'low' });
    if (request.risk === 'high' && request.humanApproval !== true) {
      return this.options.humanReview(request);
    }
    assertAgentActionAllowed(request.principal, request.action, { risk: request.risk, humanApproved: request.humanApproval });

    const sanitized = sanitizeProviderPayload(request.payload);
    const value = await this.options.execute(request, sanitized.value);
    const outputText = typeof value === 'string' ? value : JSON.stringify(value);
    const outputGuard = evaluateOutputGuardrails(outputText);
    if (!outputGuard.allowed) throw new Error(`AI_OUTPUT_GUARDRAIL:${outputGuard.reason}`);
    return { status: 'completed', value, reason: budgetDecision === 'SOFT_CAP' ? 'SOFT_CAP' : undefined };
  }
}

import type { NextFunction, Request, Response } from 'express';
import { sanitizeProviderText } from '../security/piiSanitizer';

export interface GuardrailDecision {
  allowed: boolean;
  reason?: string;
  sanitized?: string;
}

const INJECTION = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /disregard\s+(?:all\s+)?instructions?/i,
  /reveal\s+(?:the\s+)?(?:system|developer)\s+prompt/i,
  /developer\s+mode/i,
  /jailbreak/i,
  /bypass\s+(?:the\s+)?(?:safety|policy|guardrail)/i,
  /(?:system|developer)\s*:\s*(?:override|ignore)/i,
];
const TOXICITY = [/\bkill\s+(?:yourself|them)\b/i, /\b(?:terrorist|bomb|massacre)\b/i];
const COMPLIANCE = [/\b(decide|reject|rank|approve)\b.{0,80}\b(?:religion|race|ethnicity|health|disability|political|union)\b/i, /\b(?:hire|fire|terminate|deny|approve)\b.{0,80}\b(?:employee|applicant|customer)\b/i];
const CONTROL_TAG = /<\/?(?:system_instruction|developer_instruction|tool_result|untrusted_input)\b[^>]*>/i;

export function evaluateInputGuardrails(input: string): GuardrailDecision {
  const sanitized = sanitizeProviderText(input).value;
  if (CONTROL_TAG.test(input)) return { allowed: false, reason: 'CONTROL_TAG' };
  if (INJECTION.some((pattern) => pattern.test(sanitized))) return { allowed: false, reason: 'PROMPT_INJECTION' };
  if (TOXICITY.some((pattern) => pattern.test(sanitized))) return { allowed: false, reason: 'TOXICITY_POLICY' };
  if (COMPLIANCE.some((pattern) => pattern.test(sanitized))) return { allowed: false, reason: 'COMPLIANCE_POLICY' };
  return { allowed: true, sanitized };
}

export function evaluateOutputGuardrails(output: string): GuardrailDecision {
  if (!output.trim()) return { allowed: false, reason: 'EMPTY_OUTPUT' };
  if (output.length > 64_000) return { allowed: false, reason: 'OUTPUT_TOO_LARGE' };
  if (CONTROL_TAG.test(output)) return { allowed: false, reason: 'OUTPUT_CONTROL_TAG' };
  if (/BEGIN_(?:SYSTEM|DEVELOPER)_PROMPT|END_(?:SYSTEM|DEVELOPER)_PROMPT/i.test(output)) return { allowed: false, reason: 'PROMPT_LEAK' };
  if (TOXICITY.some((pattern) => pattern.test(output))) return { allowed: false, reason: 'TOXIC_OUTPUT' };
  return { allowed: true, sanitized: output.trim() };
}

export function guardrailMiddleware(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as unknown;
  const input = typeof body === 'string' ? body : body && typeof body === 'object' && typeof (body as Record<string, unknown>).prompt === 'string'
    ? String((body as Record<string, unknown>).prompt)
    : '';
  if (!input) return next();
  const decision = evaluateInputGuardrails(input);
  if (!decision.allowed) {
    res.status(422).json({ error: 'AI_GUARDRAIL_BLOCKED', reason: decision.reason });
    return;
  }
  next();
}

import fs from 'node:fs';

const required = [
  'docs/architecture/SOLUTION_DESIGN.md',
  'docs/governance/AI_GOVERNANCE_RACI.md',
  'docs/finops/BUDGET_AND_TELEMETRY.md',
  'src/security/piiSanitizer.ts',
  'src/security/rbacControl.ts',
  'src/middleware/guardrailMiddleware.ts',
  'src/telemetry/costTracker.ts',
  'src/telemetry/budgetGuard.ts',
  'src/agents/orchestrator.ts',
  'src/agents/promptRegistry.ts',
  'prompts/registry/default-agent.json',
  'config/ai-budget.json',
];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error('Phase 2 AI gate FAILED:');
  missing.forEach((file) => console.error(`- missing ${file}`));
  process.exit(1);
}
const budget = JSON.parse(fs.readFileSync('config/ai-budget.json', 'utf8'));
if (budget.defaults?.softCapPercent !== 80 || budget.defaults?.hardCapPercent !== 100) process.exit(1);
const prompt = JSON.parse(fs.readFileSync('prompts/registry/default-agent.json', 'utf8'));
if (prompt.deterministic !== true || !prompt.version || !prompt.responseSchema) process.exit(1);
console.log('Phase 2 AI gate PASS: required control-plane artifacts and fail-closed budget/prompt invariants present.');

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

if (!existsSync('scripts/evaluate-llm-security.mjs')) throw new Error('LLM evaluation script missing');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.scripts['eval:llm-security']) throw new Error('LLM evaluation script is not explicitly separated from deterministic tests');
const vitest = readFileSync('vitest.config.ts', 'utf8');
const workflow = readFileSync('.github/workflows/llm-evaluation.yml', 'utf8');
if (!vitest.includes('tests/enterprise')) throw new Error('Deterministic test suite boundary missing');
if (!workflow.includes('workflow_dispatch:')) throw new Error('Stochastic evaluation must be manually dispatched');
if (!workflow.includes('KLAR_RUN_LLM_EVAL')) throw new Error('Stochastic evaluation opt-in guard missing');
console.log('Deterministic/stochastic test separation: PASS');

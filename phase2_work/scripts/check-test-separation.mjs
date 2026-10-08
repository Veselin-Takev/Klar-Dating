import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

if (!existsSync('scripts/evaluate-llm-security.mjs')) throw new Error('LLM evaluation script missing');
const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'phase2_work', 'package.json'), 'utf8'));
if (!pkg.scripts['eval:llm-security']) throw new Error('LLM evaluation script is not explicitly separated from deterministic tests');
const vitest = readFileSync(resolve(repoRoot, 'phase2_work', 'vitest.config.ts'), 'utf8');
const workflow = readFileSync(resolve(repoRoot, '.github/workflows/llm-evaluation.yml'), 'utf8');
if (!vitest.includes('tests/enterprise')) throw new Error('Deterministic test suite boundary missing');
if (!workflow.includes('workflow_dispatch:')) throw new Error('Stochastic evaluation must be manually dispatched');
if (!workflow.includes('KLAR_RUN_LLM_EVAL')) throw new Error('Stochastic evaluation opt-in guard missing');
console.log('Deterministic/stochastic test separation: PASS');

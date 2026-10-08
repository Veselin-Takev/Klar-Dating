import { readFileSync } from 'node:fs';

const budget = readFileSync('src/server/aiBudget.ts', 'utf8');
const security = readFileSync('src/server/platform/aiPromptSecurity.ts', 'utf8');
const server = readFileSync('server.ts', 'utf8');
for (const token of ['wrapUntrustedInput', 'buildSystemInstruction', 'guardProviderOutput', 'validateProviderSchema', 'responseSchema', "responseMimeType !== 'application/json'"]) {
  if (!budget.includes(token) && !security.includes(token)) throw new Error(`AI prompt security invariant missing: ${token}`);
}
if (!security.includes('<untrusted_input>') || !security.includes('<system_instruction>')) throw new Error('XML delimiter boundary missing');

const calls = [...server.matchAll(/ai\.models\.generateContent\(\{/g)];
if (calls.length === 0) throw new Error('No Gemini calls found for prompt-security inspection');
for (const match of calls) {
  const start = match.index ?? 0;
  const block = server.slice(start, Math.min(server.length, start + 9000));
  if (!block.includes('systemInstruction:')) throw new Error('Gemini call is missing an explicit systemInstruction');
  if (!block.includes('responseSchema:')) throw new Error('Gemini call is missing responseSchema');
  if (!block.includes('responseMimeType: "application/json"')) throw new Error('Gemini call is missing application/json responseMimeType');
}
console.log(`AI prompt security boundary: PASS (${calls.length} provider call sites inspected)`);

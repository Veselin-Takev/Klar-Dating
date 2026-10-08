import { readFile } from 'node:fs/promises';

const server = await readFile('server.ts', 'utf8');
const route = await readFile('src/server/routes/aiPassgenauigkeit.ts', 'utf8');
const errors = [];

if (!server.includes('"/api/ai-passgenauigkeit"')) errors.push('AI passgenauigkeit endpoint must be registered in KI_ENDPUNKTE');
if (!server.includes('const kiLimiter = rateLimit(')) errors.push('central KI limiter missing');
if (!server.includes('topfFuer(pfad, KI_ENDPUNKTE.has(pfad))')) errors.push('central KI quota routing missing');
if (!server.includes('zweckErlaubt(daten?.einwilligung ?? null, "ki_auswertung")')) errors.push('central AI consent check missing');
if (!route.includes("router.post('/ai-passgenauigkeit'")) errors.push('AI passgenauigkeit route missing');
if (!route.includes("deps.currentUserId(req)")) errors.push('AI passgenauigkeit route must require verified user identity');
if (!route.includes("'/api/ai-passgenauigkeit'")) errors.push('AI budget endpoint identity missing');

if (errors.length) {
  console.error(`AI passgenauigkeit boundary: FAIL\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('AI passgenauigkeit boundary: PASS');

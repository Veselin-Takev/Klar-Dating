import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const engine = fs.readFileSync('src/server/platform/translationEngine.ts', 'utf8');
const service = fs.readFileSync('src/server/translationService.ts', 'utf8');
const chat = fs.readFileSync('src/screens/ChatView.tsx', 'utf8');
const bubble = fs.readFileSync('src/components/MessageBubble.tsx', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  ['authenticated translate route mounted', /app\.post\(['"]\/api\/translate['"],\s*handleTranslation\)/.test(server)],
  ['translation endpoint sanitizes input', /sanitizePromptInput\(text\)/.test(engine)],
  ['translation endpoint requires authenticated user', /const uid = currentUserId\(req\);[\s\S]*if \(!uid\)/.test(engine)],
  ['no paid AI fallback', !engine.includes('createBudgetedAI') && !engine.includes('GEMINI_API_KEY')],
  ['bounded translation timeout', /TRANSLATION_TIMEOUT_MS\s*=\s*1500/.test(service)],
  ['incoming-only live translation', /message\.role === 'verbindung'/.test(chat) && !/message\.role === 'user'[\s\S]*\/api\/translate/.test(chat)],
  ['translation never changes sent payload', /const msgText = input/.test(chat) && /body: JSON\.stringify\(submission\)/.test(chat)],
  ['translation preserves original', /originalText: message\.text/.test(chat)],
  ['translation uses authenticated API', /Authorization: `Bearer \$\{token\}`/.test(chat)],
  ['translation state is visible and reversible', /showOriginal/.test(bubble) && /showTranslation/.test(bubble)],
  ['enterprise gate registered', Boolean(packageJson.scripts?.['check:chat-translation'])],
];

for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log('Chat translation boundary: PASS');

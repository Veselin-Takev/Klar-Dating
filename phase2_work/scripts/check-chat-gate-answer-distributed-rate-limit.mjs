import { readFileSync } from 'node:fs';

const source = readFileSync('src/server/routes/chat.ts', 'utf8');
const required = [
  /CHAT_GATE_ANSWER_RATE_LIMIT_COLLECTION = 'chat_gate_answer_rate_limits'/,
  /CHAT_GATE_ANSWER_RATE_LIMIT_WINDOW_MS = 60_000/,
  /CHAT_GATE_ANSWER_RATE_LIMIT_MAX = 10/,
  /async function distributedChatGateAnswerRateLimit\(/,
  /klar-chat-gate-answer:/,
  /runTransaction\(async tx =>/,
  /if \(count >= CHAT_GATE_ANSWER_RATE_LIMIT_MAX\) return false;/,
  /return res\.status\(503\)\.json\(\{ error: 'Gate-Antwortlimit derzeit nicht verfügbar\.' \}\)/,
  /const gateAnswerLimiter = distributedChatGateAnswerRateLimit;/,
  /router\.post\('\/gate\/answer',\s*gateAnswerLimiter,\s*handleGateAnswer/,
];
if (/gateAnswerLimiter\s*=\s*rateLimit\(/.test(source)) throw new Error('Gate-answer limiter must not use process-local express-rate-limit MemoryStore');
for (const pattern of required) if (!pattern.test(source)) throw new Error(`Missing distributed gate-answer boundary: ${pattern}`);
console.log('Chat gate-answer distributed rate limit: PASS');

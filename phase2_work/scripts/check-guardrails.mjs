import fs from 'fs';
import { globSync } from 'glob';

const BANNED_TERMS = [
  /canvas-confetti/i,
  /Math\.random/,
  /navigator\.vibrate/,
  /\bswipe[s]?\b/i,
  /\bswiping\b/i
];

let failed = false;
const files = globSync('src/**/*.{ts,tsx,css,json,html}');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const regex of BANNED_TERMS) {
    if (regex.test(content)) {
      console.error(`[Guardrail Violation] Prohibited term ${regex} found in ${file}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("FAIL: Product guardrails violated. Remove gamification/fake metrics.");
  process.exit(1);
} else {
  console.log("PASS: Product guardrails intact.");
}

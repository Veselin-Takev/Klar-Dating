import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/server/accountDeletion.ts',
  'src/server/verification/diditKyc.ts',
];
const maxBytes = '64 * 1024';
for (const rel of files) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  if (!text.includes(`DIDIT_RESPONSE_MAX_BYTES = ${maxBytes}`)) throw new Error(`${rel}: missing 64 KiB cap`);
  if (!text.includes('readBoundedResponse(response, DIDIT_RESPONSE_MAX_BYTES')) throw new Error(`${rel}: missing pre-parse response size checks`);
  if (/response\.(?:json|text|arrayBuffer)\(\)/.test(text)) throw new Error(`${rel}: unbounded response consumption remains`);
}
console.log('Didit provider response boundary: PASS');

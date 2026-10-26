import fs from 'node:fs';

const source = fs.readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const required = [
  "text({ inflate: false, type: 'application/json', limit: '256kb' })",
  'event_id: z.string().uuid()',
  'id_verifications: z.array(step).max(16)',
  'liveness_checks: z.array(step).max(16)',
  'face_matches: z.array(step).max(16)',
  'if (receipt.exists) return { duplicate: true }',
  'verifyDiditSignatureText(rawBody, signature, timestamp, config.webhookSecret, now)',
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Didit webhook boundary missing: ${marker}`);
}
console.log('Didit webhook boundary: PASS');

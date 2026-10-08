import { readFileSync } from 'node:fs';
const server = readFileSync('src/server/passwordReset.ts', 'utf8');
const email = readFileSync('src/server/email.ts', 'utf8');
const client = readFileSync('src/core/auth/passwordResetService.ts', 'utf8');
for (const forbidden of ['resetTokenStore', 'randomBytes(32)', 'hashToken(', 'record.uid', 'record.used']) {
  if (server.includes(forbidden)) throw new Error(`Legacy password-reset token authority remains: ${forbidden}`);
}
if (!server.includes("type: 'password_reset'")) throw new Error('Forgot-password must enqueue a durable password_reset job');
if (!email.includes('generatePasswordResetLink')) throw new Error('Mail worker must generate Firebase password-reset OOB link at dispatch time');
if (!client.includes("fetch('/api/auth/forgot-password'")) throw new Error('Client must use the backend recovery queue');
for (const legacyRoute of ["fetch('/api/auth/verify-reset-token'", "fetch('/api/auth/reset-password'"]) {
  if (client.includes(legacyRoute)) throw new Error(`Client still calls retired endpoint: ${legacyRoute}`);
}
console.log('PASS: Firebase is the sole password-reset token authority; legacy server token flow is retired.');

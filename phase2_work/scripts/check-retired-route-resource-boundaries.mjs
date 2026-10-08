import { readFileSync } from 'node:fs';

const server = readFileSync('server.ts', 'utf8');
const required = [
  ['retired verification route must not parse JSON', 'app.use("/api/verification", verificationRouter);'],
  ['forgot-password must use bounded strict JSON', 'app.post("/api/auth/forgot-password", express.json({ limit: "8kb", strict: true }), forgotPasswordIpLimiter, handleForgotPassword);'],
  ['retired reset-token verification route must not parse JSON', 'app.post("/api/auth/verify-reset-token", handleVerifyResetToken);'],
  ['retired reset-password route must not parse JSON', 'app.post("/api/auth/reset-password", handleResetPassword);'],
];
for (const [label, snippet] of required) if (!server.includes(snippet)) throw new Error(label);
for (const forbidden of [
  'app.use("/api/verification", express.json(), verificationRouter);',
  'app.post("/api/auth/forgot-password", express.json(), forgotPasswordIpLimiter, handleForgotPassword);',
  'app.post("/api/auth/verify-reset-token", express.json(), handleVerifyResetToken);',
  'app.post("/api/auth/reset-password", express.json(), handleResetPassword);',
]) if (server.includes(forbidden)) throw new Error(`unbounded/legacy JSON parser remains: ${forbidden}`);
console.log('PASS: retired routes parse no request body; forgot-password uses a bounded strict JSON parser.');

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const modal = readFileSync('src/components/BiometricsVerificationModal.tsx', 'utf8');
const kyc = readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const server = readFileSync('server.ts', 'utf8');

assert(modal.includes("authFetch('/api/kyc/status')"), 'Profile KYC refresh must call authenticated Didit status');
assert(!modal.includes("authFetch('/api/verification/status')"), 'Retired manual verification route must never be queried');
assert(modal.includes("status === 'approved'"), 'Only provider approved status may grant UI success');
assert(!/result\.isVerified\s*===\s*true/.test(modal), 'Client-visible legacy bool must not be verification authority');
assert(modal.includes("!response.ok"), 'Non-2xx Didit failures must not grant verification');
assert(kyc.includes("router.get('/status', kycStatusReadLimiter"), 'Didit status must be server-protected and rate-limited');
assert(server.includes("app.use('/api/kyc', createKycRouter(kycDependencies))"), 'Didit status router must remain mounted');
console.log('PASS: profile refresh uses provider-backed Didit status, retired endpoint forbidden.');

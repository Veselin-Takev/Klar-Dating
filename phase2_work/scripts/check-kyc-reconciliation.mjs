import { readFileSync } from 'node:fs';

const source = readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const functions = readFileSync('functions/src/index.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const failures = [];
const require = (condition, message) => { if (!condition) failures.push(message); };
require(source.includes('/v3/session/${encodeURIComponent(claimed)}/decision/'), 'KYC reconciliation must use the Didit v3 decision endpoint.');
require(source.includes("process.env.KYC_RECONCILIATION_JOB_SECRET"), 'KYC reconciliation endpoint must require a dedicated job secret.');
require(source.includes('validKycReconciliationJobSignature'), 'KYC reconciliation must verify an HMAC job signature.');
require(source.includes("where('status', 'in', ['pending', 'review'])"), 'Reconciliation must only poll non-final KYC accounts.');
require(source.includes('maxSessions = 10'), 'Reconciliation must have a bounded default batch size.');
require(source.includes('currentAccount.data()?.sessionId !== claimed'), 'Reconciliation must re-check session ownership before writes.');
require(source.includes('reconcileLeaseUntil'), 'Reconciliation must claim each account with a bounded lease before polling.');
require(source.includes('deletion.exists'), 'Reconciliation must not write to an account pending deletion.');
require(source.includes('transitionKycAccountStatus(currentStatus, result.data.status, approved)'), 'Reconciliation must use the explicit KYC state machine for provider statuses.');
require(functions.includes("defineSecret('KYC_RECONCILIATION_JOB_SECRET')"), 'Scheduled reconciliation must use a Firebase secret.');
require(functions.includes("schedule: 'every 15 minutes'"), 'Scheduled reconciliation must have an explicit bounded cadence.');
require(functions.includes("/internal/kyc/reconcile"), 'Scheduler must call the dedicated internal reconciliation endpoint.');
require(pkg.scripts['check:enterprise']?.includes('check:kyc-reconciliation'), 'KYC reconciliation gate must run in check:enterprise.');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('KYC reconciliation gate PASS: bounded, signed, session-bound and fail-closed.');

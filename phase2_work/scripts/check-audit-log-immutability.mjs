import { readFileSync } from 'node:fs';

const rules = readFileSync('firestore.rules', 'utf8');
const auditMatch = rules.match(/match\s+\/audit_logs\/\{entryId\}[\s\S]*?(?=\n\s*match\s|\n\s*}\s*$)/);
if (!auditMatch) throw new Error('audit_logs Firestore rule missing');
const auditRule = auditMatch[0];
if (!/allow\s+read\s*:\s*if\s+isPrivilegedClaim\(\)/.test(auditRule)) throw new Error('audit_logs read is not RBAC protected');
if (!/allow\s+create,\s*update,\s*delete\s*:\s*if\s+false/.test(auditRule)) throw new Error('audit_logs is not append-only for clients');

const consent = readFileSync('src/server/platform/consentEngine.ts', 'utf8');
const consentWrites = [...consent.matchAll(/tx\.set\(auditLogRef,\s*\{([\s\S]*?)\}\);/g)].map((m) => m[1]);
if (!consentWrites.length) throw new Error('consent audit writes missing');
if (consentWrites.some((body) => /\buserId\b/.test(body))) throw new Error('consent audit log must never persist a raw userId');
if (!consent.includes('subjectPseudonym')) throw new Error('consent audit pseudonym boundary missing');

for (const file of ['src/server/messages.ts', 'src/server/passwordReset.ts']) {
  const source = readFileSync(file, 'utf8');
  if (/collection\(['"]audit_logs['"]\)\.(?:doc\([^)]*\)\.)?(?:update|delete)/.test(source)) {
    throw new Error(`${file} mutates audit_logs directly`);
  }
}

if (!readFileSync('src/server/platform/auditLog.ts', 'utf8').includes('ref.create(payload)')) {
  throw new Error('central append-only audit writer missing');
}
console.log('Audit log append-only boundary: PASS');

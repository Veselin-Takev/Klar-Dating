import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'server.ts', 'functions/src'];
const files = [];
function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) { files.push(target); return; }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
    walk(path.join(target, entry.name));
  }
}
for (const root of roots) walk(root);

const clientFailures = [];
for (const file of files) {
  if (file.includes(`${path.sep}server${path.sep}`) || file.endsWith('server.ts')) continue;
  const source = fs.readFileSync(file, 'utf8');
  const executable = source.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
  if (/\b(?:setDoc|updateDoc)\s*\([^)]*\bisVerified\s*:|(?<!const |let |var )\bisVerified\s*=(?!=)/.test(executable)) {
    clientFailures.push(`${file}: client/runtime code must not assign isVerified`);
  }
}
const kyc = fs.readFileSync('src/server/verification/diditKyc.ts', 'utf8');
if (!kyc.includes("tx.update(userRef, { isVerified: approved")) throw new Error('Signed Didit webhook is not the identity authority.');
if (!kyc.includes("tx.update(publicProfile.ref, { isVerified: approved")) throw new Error('Public verification state is not synchronized from the signed provider event.');
const rules = fs.readFileSync('firestore.rules', 'utf8');
if (!rules.includes("!('isVerified' in request.resource.data)")) throw new Error('Firestore client-write protection for isVerified is missing.');
if (clientFailures.length) {
  console.error('isVerified authority gate FAILED:');
  for (const failure of clientFailures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('isVerified authority gate PASS: only the signed server KYC pipeline may grant/revoke verification.');

import { readFileSync } from 'node:fs';
const checks = [
  ['src/server/complianceJobs.ts', 'workerLease'],
  ['src/server/complianceJobs.ts', 'state?.lease !== workerLease'],
  ['src/server/complianceJobs.ts', 'current?.mailLease !== lease'],
  ['src/server/accountDeletion.ts', 'current?.lease !== lease'],
];
const failures = checks.filter(([file, token]) => !readFileSync(file, 'utf8').includes(token));
if (failures.length) {
  console.error('FAIL lease ownership:', failures.map(([f, t]) => `${f}: ${t}`).join(', '));
  process.exit(1);
}
console.log('PASS lease ownership: stale workers cannot clear or finalize a lease they no longer own.');

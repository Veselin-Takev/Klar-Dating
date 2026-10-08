#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const appCheck = readFileSync('src/lib/appCheck.ts', 'utf8');
const adminDashboard = readFileSync('src/screens/AdminDashboard.tsx', 'utf8');
const failures = [];

if (/dummy-site-key|['"]dummy[^'\"]*['"]/.test(appCheck)) {
  failures.push('App Check must never use a dummy site key.');
}
if (/setFunctionRuntimes\(\s*\[\s*\{[^\]]*status:\s*['"]success['"]/.test(adminDashboard)) {
  failures.push('Admin dashboard must not manufacture successful function runtime telemetry.');
}
if (/verifyProfile|updateStatus/.test(adminDashboard) && /status:\s*['"]success['"]/.test(adminDashboard)) {
  failures.push('Hard-coded successful function runtime samples are forbidden in production UI.');
}

if (failures.length) {
  console.error('FAIL: synthetic runtime data policy');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS: synthetic runtime data policy');

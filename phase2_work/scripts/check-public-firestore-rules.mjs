import { readFileSync } from 'node:fs';

// Both directories have an independently valid firebase.json pointing to
// their respective firestore.rules. Do not verify only the CI workdir copy.
const deployments = [
  { rules: 'firestore.rules', config: 'firebase.json' },
  { rules: '../firestore.rules', config: '../firebase.json' },
];
const forbidden = [
  /allow\s+(?:read|get|list|write|create|update|delete)\s*:\s*if\s+true\s*;/g,
  /allow\s+read\s*:\s*if\s+true\b/g,
];

for (const { rules: file, config } of deployments) {
  // Do not keep checking an obsolete rules file if either deployment root
  // switches to a different path without a corresponding gate update.
  const firebaseConfig = JSON.parse(readFileSync(config, 'utf8'));
  if (firebaseConfig.firestore?.rules !== 'firestore.rules') {
    throw new Error(config + ': unreviewed Firebase rules path: update the security gate');
  }
  const text = readFileSync(file, 'utf8')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n');

  const failures = [];
  for (const pattern of forbidden) {
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index ?? 0).split('\n').length;
      failures.push(file + ':' + line + ': unconditional public access rule is forbidden');
    }
  }
  if (failures.length) {
    throw new Error('Public Firestore rules gate FAILED:\n' + failures.join('\n'));
  }

  // A cheap source-level regression guard, NOT a compiler, grammar parser,
  // proof of exact match scoping, or complete privacy authorization audit.
  const publicProfileMatch = text.match(
    /match\s+\/public_profiles\/\{userId\}[\s\S]*?allow\s+write\s*:\s*if\s+false\s*;/,
  );
  const publicProfile = publicProfileMatch?.[0] ?? '';
  if (!publicProfile.includes(
    'get(/databases/$(database)/documents/users/$(userId)).data.isAdult == true'
  )) {
    throw new Error(file + ': public_profiles reads are not bound to the target adult gate');
  }

  // Parent-scoped helper cannot access a child match's userId implicitly.
  const usersMatchStart = text.indexOf('match /users/{userId}');
  if (usersMatchStart < 0 ||
      !/\bfunction\s+validUserMutableUpdate\s*\(\s*userId\s*\)/.test(text) ||
      !/\bvalidUserMutableUpdate\s*\(\s*userId\s*\)/.test(text.slice(usersMatchStart)) ||
      /\bvalidUserMutableUpdate\s*\(\s*\)/.test(text)) {
    throw new Error(file + ': Firestore rules userId must be an explicit scoped helper argument');
  }
}

console.log('Public Firestore rules gate PASS (both rule files; static source checks only).');
console.log('Firestore rules scoped userId PASS (both rule files; emulator still required).');

import { readFileSync } from 'node:fs';

const rules = readFileSync('firestore.rules', 'utf8');
const authz = readFileSync('src/server/authorization.ts', 'utf8');
if (!rules.includes('request.auth.token.roles')) throw new Error('Firestore RBAC does not use custom claims roles');
if (!rules.includes('function isPrivilegedClaim')) throw new Error('Firestore privileged custom-claim boundary missing');
if (!authz.includes('roles')) throw new Error('Server RBAC role claims missing');
if (authz.includes('users/{') || authz.includes('collection(\'users\')')) throw new Error('RBAC must not depend on user profile role fields');
console.log('RBAC custom-claims boundary: PASS');

import { readFileSync } from 'node:fs';

const env = readFileSync('src/server/envValidation.ts', 'utf8');
const example = readFileSync('.env.example', 'utf8');

const required = ['KLAR_PUBLIC_URL', 'SENDGRID_FROM_EMAIL'];
for (const name of required) {
  if (!env.includes(`"${name}"`)) throw new Error(`${name} must be required in production environment validation`);
  if (!new RegExp(`^${name}=`, 'm').test(example)) throw new Error(`${name} must be documented in .env.example`);
}
for (const obsolete of ['APP_BASE_URL', 'METRICS_AUTH_TOKEN']) {
  if (env.includes(`"${obsolete}"`)) throw new Error(`${obsolete} is obsolete but still referenced by environment validation`);
}
if (!env.includes('"METRICS_TOKEN"')) throw new Error('METRICS_TOKEN must be the documented metrics credential');
console.log('PASS: environment contract uses KLAR_PUBLIC_URL and METRICS_TOKEN; obsolete names are absent.');

import { readFileSync, existsSync } from 'node:fs';

const dockerfile = 'Dockerfile';
if (!existsSync(dockerfile)) throw new Error('Dockerfile is required because CI and release build the repository root as a container context');

const text = readFileSync(dockerfile, 'utf8');
const required = [
  ['multi-stage build', /^FROM .+ AS build$/m],
  ['digest-pinned Bun build image', /^FROM oven\/bun:1\.4\.4@sha256:[0-9a-f]{64} AS build$/m],
  ['digest-pinned Node runtime image', /^FROM node:22\.23\.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS runtime$/m],
  ['frozen Bun lockfile install', /bun install --frozen-lockfile/],
  ['production dependency pruning', /bun install --frozen-lockfile --production/],
  ['non-root runtime', /^USER node$/m],
  ['production runtime mode', /NODE_ENV=production/],
  ['Cloud Run port', /PORT=8080/],
  ['bundled server entrypoint', /CMD \["node", "dist\/server\.cjs"\]/],
  ['runtime Firebase configuration', /firebase-applet-config\.json/],
];

const failures = required.filter(([, pattern]) => !pattern.test(text));
if (failures.length) {
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

if (/COPY .*\.env/.test(text) || /ARG .*?(SECRET|TOKEN|PASSWORD|API_KEY)/i.test(text)) {
  throw new Error('Dockerfile must not copy dotenv files or accept secrets as build arguments');
}

console.log(`Container build contract PASS (${required.length} invariants)`);

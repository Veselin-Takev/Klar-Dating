// P0 #202: static source boundary. This checks the repository candidate, NOT
// deployed Firebase rules, Cloud IAM, or privileged Admin SDK writer inventory.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(resolve(root, relative), 'utf8');

const retiredPaths = ['/verify', '/status', '/challenge', '/submit', '/decide'];

export function verifyLegacyVerificationWriterFence({ routes, server, rules }) {
  // These are the only historical manual routes. They must remain non-mutating
  // and return HTTP 410 for every HTTP method, including POST and GET.
  const match = routes.match(/for\s*\(\s*const path of \[([^\]]+)\]\s*\)/);
  if (!match) throw Error('legacy_verification_route_list_missing');
  const actual = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
  if (actual.length !== retiredPaths.length ||
      actual.slice().sort().join('|') !== retiredPaths.slice().sort().join('|')) {
    throw Error('legacy_verification_retired_paths_changed');
  }
  if (!/verificationRouter\.all\(path,\s*\(_req,\s*res\)\s*=>\s*\{/.test(routes) ||
      !/res\.status\(410\)\.json\(\{\s*code:\s*['"]verification_retired['"]/.test(routes)) {
    throw Error('legacy_verification_no_longer_410_for_all_methods');
  }
  if (!/import\s*\{\s*verificationRouter\s*\}\s*from\s*['"]\.\/src\/server\/verification-routes['"]/.test(server) ||
      !/app\.use\(\s*['"]\/api\/verification['"]\s*,\s*verificationRouter\s*\)/.test(server)) {
    throw Error('legacy_verification_410_router_not_mounted');
  }
  if (/\bhandleVerification(?:Submit|Decide|Challenge|Status)\b/.test(server)) {
    throw Error('legacy_verification_mutating_handler_reintroduced');
  }
  // Firebase Storage Rules apply to clients, not service accounts or Admin SDK.
  // Deny every client operation on old biometrics; check the exact rule block.
  const blocks = [...rules.matchAll(/match\s+\/verification\/\{uid\}\/\{datei\}\s*\{([^{}]*)\}/g)];
  if (blocks.length !== 1) throw Error('legacy_verification_storage_rule_missing_or_duplicated');
  const block = blocks[0][1];
  for (const verb of ['read', 'delete']) {
    if (!new RegExp('allow\\s+' + verb + '\\s*:\\s*if\\s+false\\s*;').test(block)) {
      throw Error('legacy_verification_client_' + verb + '_not_denied');
    }
  }
  if (!/allow\s+create\s*,\s*update\s*:\s*if\s+false\s*;/.test(block)) {
    throw Error('legacy_verification_client_upload_not_denied');
  }
}

export function checkRepositoryLegacyVerificationWriterFence() {
  verifyLegacyVerificationWriterFence({
    routes: read('src/server/verification-routes.ts'),
    server: read('server.ts'),
    rules: read('storage.rules'),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkRepositoryLegacyVerificationWriterFence();
  console.log('Legacy verification writer/client boundary: PASS (source only)');
}

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const excluded = new Set(['google-cloud-sdk', 'node_modules', '.git', 'dist', 'build']);
const maxBytes = 32 * 1024 * 1024;
const rules = [
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/g],
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
  ['stripe-secret', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g],
  ['stripe-webhook', /\bwhsec_[A-Za-z0-9]{16,}/g],
  ['sendgrid', /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['google-oauth-secret', /\bGOCSPX-[A-Za-z0-9_-]{28,}/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}/g],
  ['npm-token', /\bnpm_[A-Za-z0-9]{36,}/g],
];

// Existing public web-config exception, bound to field/path/value.
// This is NOT evidence that Cloud API restrictions have been verified.
const publicKeyHash = 'd1037ccf2bde74c8cb63ccaa959965577505726dc33ebc51d7c02b986141205b';
function redactPublicConfig(content, relativePath) {
  if (relativePath !== 'firebase-applet-config.json') return content;
  let config;
  try { config = JSON.parse(content); } catch { throw new Error('invalid-public-config'); }
  const fields = [...content.matchAll(/"apiKey"\s*:\s*"([^"\\]*)"/g)];
  if (config?.projectId !== 'striped-antler-500815-e6' || fields.length !== 1) return content;
  if (createHash('sha256').update(fields[0][1]).digest('hex') !== publicKeyHash) return content;
  return content.replace(fields[0][0], '"apiKey": "PUBLIC_FIREBASE_WEB_KEY"');
}

export function scanContent(content, relativePath) {
  const inspected = redactPublicConfig(content, relativePath);
  const findings = [];
  for (const [rule, pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of inspected.matchAll(pattern)) {
      findings.push({ path: relativePath, rule, line: inspected.slice(0, match.index).split('\n').length });
    }
  }
  return findings;
}

export function scanDirectory(root) {
  const findings = [];
  let scanned = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && excluded.has(entry.name)) continue;
      const file = path.join(dir, entry.name);
      const relativePath = path.relative(root, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw new Error('unsupported-symlink');
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.isFile()) throw new Error('unsupported-file');
      if (fs.statSync(file).size > maxBytes) throw new Error('file-size-limit');
      findings.push(...scanContent(fs.readFileSync(file, 'utf8'), relativePath));
      scanned++;
    }
  }
  walk(root);
  if (!scanned) throw new Error('empty-scan');
  return { findings, scanned };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { findings, scanned } = scanDirectory(process.cwd());
    for (const item of findings) console.error(JSON.stringify(item));
    console.log(`Secret pattern check: ${findings.length ? 'FAIL' : 'PASS'} (${scanned} files; current working tree only)`);
    process.exitCode = findings.length ? 1 : 0;
  } catch {
    console.error('Secret pattern check: INCOMPLETE; unreadable, invalid, oversized or unsupported input');
    process.exitCode = 2;
  }
}


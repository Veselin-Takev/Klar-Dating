import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function listSourceFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) result.push(...listSourceFiles(fullPath));
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !/\.(?:spec|test)\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

export function inspectDirectProfileImageSources(source) {
  const violations = [];
  for (const match of source.matchAll(/<img\b[^>]*>/gs)) {
    const tag = match[0];
    const src = tag.match(/\bsrc\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/s)?.[1] ?? '';
    if (/\b(?:photoUrl|photoURL|photoStoragePath|mediaRef)\b|\/api\/profile-media|klar-media:v1:/i.test(src)) {
      violations.push(tag.slice(0, 240));
    }
  }
  return violations;
}

export function hasUnsafeProfileDownloadUrlPersistence(source) {
  return /getDownloadURL\s*\(/.test(source)
    && /(?:profiles\/|photoURL|photoUrl|photoStoragePath)/i.test(source);
}

export function profileStorageReadIsDenied(rules) {
  const block = rules.match(/match\s+\/profiles\/\{uid\}\/\{datei\}\s*\{([\s\S]{0,200})/);
  return Boolean(block && /allow\s+read\s*:\s*if\s+false\s*;/.test(block[1]));
}

export function inspectProfileMediaBoundary({ sourceFiles, rootRules, phase2Rules, apiSource, serverSource }) {
  const violations = [];
  for (const [file, source] of sourceFiles) {
    for (const tag of inspectDirectProfileImageSources(source)) {
      violations.push(`${file}: direct profile media img source ${tag}`);
    }
    if (hasUnsafeProfileDownloadUrlPersistence(source)) {
      violations.push(`${file}: getDownloadURL() used in profile media source`);
    }
  }
  if (!profileStorageReadIsDenied(rootRules)) violations.push('storage.rules: direct profile Storage reads must remain denied');
  if (!profileStorageReadIsDenied(phase2Rules)) violations.push('phase2_work/storage.rules: direct profile Storage reads must remain denied');
  if (/\b(?:input|resource)\.toString\s*\(/.test(apiSource)) violations.push('src/lib/api.ts: raw request URL toString() remains');
  if (!/referrerPolicy\s*:\s*\{\s*policy\s*:\s*['"]no-referrer['"]\s*\}/.test(serverSource)) {
    violations.push('server.ts: active Helmet middleware must enforce no-referrer');
  }
  return violations;
}

export function runProfileMediaBoundaryCheck(root = process.cwd()) {
  const sourceRoot = path.join(root, 'src');
  const sourceFiles = listSourceFiles(sourceRoot).map(file => [path.relative(root, file), readFileSync(file, 'utf8')]);
  const result = inspectProfileMediaBoundary({
    sourceFiles,
    rootRules: readFileSync(path.resolve(root, '../storage.rules'), 'utf8'),
    phase2Rules: readFileSync(path.join(root, 'storage.rules'), 'utf8'),
    apiSource: readFileSync(path.join(sourceRoot, 'lib/api.ts'), 'utf8'),
    serverSource: readFileSync(path.join(root, 'server.ts'), 'utf8'),
  });
  assert.deepEqual(result, [], result.join('\n'));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runProfileMediaBoundaryCheck();
  console.log('Profile media boundary: PASS');
}

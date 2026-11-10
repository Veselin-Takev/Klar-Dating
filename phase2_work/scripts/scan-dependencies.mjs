import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function inventory(files, parse) {
  const versions = new Map(); const hashes = {};
  for (const [file, text] of files) {
    hashes[file] = crypto.createHash('sha256').update(text).digest('hex');
    const result = parse(file, text);
    if (result.error || !result.config?.packages || typeof result.config.packages !== 'object' || Array.isArray(result.config.packages)) throw Error('Invalid lockfile');
    let resolvedEntries = 0;
    for (const [key, entry] of Object.entries(result.config.packages)) {
      if (!key) continue;
      let name, version;
      if (file.endsWith('bun.lock')) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string') throw Error('Invalid Bun entry');
        const at = entry[0].lastIndexOf('@'); name = entry[0].slice(0, at); version = entry[0].slice(at + 1);
      } else {
        if (!entry || typeof entry !== 'object' || entry.link) { if (entry?.link) continue; throw Error('Invalid npm entry'); }
        name = entry.name || key.split('node_modules/').pop(); version = entry.version;
      }
      if (!name || typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) throw Error('Unresolved package version');
      resolvedEntries++;
      versions.set(name + '@' + version, { name, version });
    }
    if (!resolvedEntries) throw Error('Empty lockfile inventory');
  }
  if (!versions.size) throw Error('Empty dependency inventory');
  return { packages: [...versions.values()], hashes };
}
export async function query(packages, request = fetch) {
  const ids = new Set(); let affected = 0;
  for (let i = 0; i < packages.length; i += 500) {
    const batch = packages.slice(i, i + 500);
    const response = await request('https://api.osv.dev/v1/querybatch', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: batch.map(p => ({ package: { ecosystem: 'npm', name: p.name }, version: p.version })) }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw Error('OSV request failed');
    const data = await response.json();
    if (!Array.isArray(data.results) || data.results.length !== batch.length) throw Error('Incomplete OSV response');
    for (const result of data.results) {
      if (!result || result.next_page_token || (result.vulns !== undefined && !Array.isArray(result.vulns))) throw Error('Unresolved OSV response');
      const vulns = result.vulns || [];
      if (vulns.length) affected++;
      for (const vuln of vulns) { if (typeof vuln?.id !== 'string' || !vuln.id) throw Error('Invalid advisory'); ids.add(vuln.id); }
    }
  }
  return { queriedVersions: packages.length, affectedVersions: affected, uniqueAdvisories: ids.size };
}
async function main() {
  const ts = (await import('typescript')).default;
  const root = path.resolve(import.meta.dirname, '../..');
  const files = ['bun.lock', 'phase2_work/bun.lock', 'phase2_work/functions/package-lock.json'];
  const data = inventory(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]), ts.parseConfigFileTextToJson);
  const counts = await query(data.packages);
  // Aggregate evidence only: never publish detailed unresolved findings in CI logs.
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), source: 'https://api.osv.dev/v1/querybatch', hashes: data.hashes, ...counts }));
  if (counts.affectedVersions) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Dependency scan incomplete; no clean verdict.'); process.exitCode = 2; });
}

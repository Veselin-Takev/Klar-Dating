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
export async function query(packages, request = fetch, onFinding = undefined) {
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
    for (let k = 0; k < data.results.length; k++) {
      const result = data.results[k];
      if (!result || result.next_page_token || (result.vulns !== undefined && !Array.isArray(result.vulns))) throw Error('Unresolved OSV response');
      const vulns = result.vulns || [];
      if (vulns.length) affected++;
      const advisoryIds = new Set();
      for (const vuln of vulns) {
        if (typeof vuln?.id !== 'string' || !vuln.id || vuln.id.length > 180) throw Error('Invalid advisory');
        advisoryIds.add(vuln.id);
        ids.add(vuln.id);
      }
      // A complete querybatch response is validated before any report is
      // published. Only public npm name/version and advisory IDs are retained.
      if (advisoryIds.size && onFinding) {
        const pkg = batch[k];
        onFinding({ name: pkg.name, version: pkg.version, advisoryIds: [...advisoryIds].sort() });
      }
    }
  }
  return { queriedVersions: packages.length, affectedVersions: affected, uniqueAdvisories: ids.size };
}
async function main() {
  const ts = (await import('typescript')).default;
  const root = path.resolve(import.meta.dirname, '../..');
  const files = ['bun.lock', 'phase2_work/bun.lock', 'phase2_work/functions/package-lock.json'];
  const data = inventory(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]), ts.parseConfigFileTextToJson);
  const findings = [];
  const counts = await query(data.packages, fetch, item => findings.push(item));
  const generatedAt = new Date().toISOString();
  const report = { schemaVersion: 1, generatedAt, source: 'https://api.osv.dev/v1/querybatch',
    hashes: data.hashes, ...counts,
    findings: findings.sort((a, b) => (a.name + '@' + a.version).localeCompare(b.name + '@' + b.version)) };
  if (report.findings.length !== counts.affectedVersions) throw Error('Incomplete advisory inventory');
  const reportPath = process.env.KLAR_DEPENDENCY_REPORT_PATH;
  if (reportPath) {
    // Only use an absolute, workflow-controlled JSON destination. Do not
    // emit advisory lists into public CI logs or persistent repository files.
    if (!path.isAbsolute(reportPath) || path.basename(reportPath) !== 'klar-dependency-findings.json')
      throw Error('Invalid dependency scan report destination');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  // Preserve the existing fail-closed scan verdict on any unresolved version.
  console.log(JSON.stringify({ generatedAt, source: report.source, hashes: data.hashes, ...counts }));
  if (counts.affectedVersions) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Dependency scan incomplete; no clean verdict.'); process.exitCode = 2; });
}

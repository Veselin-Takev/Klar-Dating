#!/usr/bin/env node
/** P0 #254: source-only deterministic Firebase Rules evidence. NOT deployed rule proof. */
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = Object.freeze({firestore:'firestore.rules',storage:'storage.rules'});
const sha256 = data => createHash('sha256').update(data).digest('hex');

export function validateRulesConfig(production, emulator) {
  if (!production || typeof production !== 'object' || Array.isArray(production) ||
      !emulator || typeof emulator !== 'object') throw new Error('rules_config_invalid');
  for (const [service, file] of Object.entries(required)) {
    if (!production[service] || typeof production[service] !== 'object' ||
        production[service].rules !== file) throw new Error('rules_config_missing_' + service);
  }
  if (emulator.firestore?.rules !== required.firestore) throw new Error('emulator_rule_path_divergence');
  return Object.freeze({...required});
}

export function inspectRules(path, content) {
  if (!Object.values(required).includes(path) || typeof content !== 'string' ||
      !content.startsWith("rules_version = '2';") || !content.includes('match /')) {
    throw new Error('rules_source_invalid');
  }
  const lines = content.split(/\r?\n/);
  const patterns = path === 'firestore.rules'
    ? [['legacy_users', /match\s+\/users\/\{userId\}/],
       ['tenant_namespace', /match\s+\/tenants\/\{tenantId\}/]]
    : [['biometric_verification', /match\s+\/verification\/\{uid\}/],
       ['tenant_namespace', /match\s+\/tenants\/\{tenantId\}/],
       ['profile_images', /match\s+\/profiles\/\{uid\}/]];
  return {
    path, sha256:sha256(content), bytes:Buffer.byteLength(content),
    findings:patterns.map(([kind,pattern])=>({
      kind, lines:lines.flatMap((line,i)=>pattern.test(line)?[i+1]:[]),
    })),
    tenantIsolationCertified:false, deployedRulesVerified:false,
  };
}

export function buildRulesEvidence(production, emulator, sources) {
  const paths = validateRulesConfig(production, emulator);
  if (!sources || typeof sources !== 'object') throw new Error('rules_sources_invalid');
  return {
    schemaVersion:1, configPaths:paths,
    surfaces:Object.values(paths).sort().map(path=>inspectRules(path,sources[path])),
    readOnly:true, isolationAndDeploymentApproval:'BLOCKED_INDEPENDENT_REVIEW',
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
    const production=JSON.parse(readFileSync(resolve(root,'firebase.json'),'utf8'));
    const emulator=JSON.parse(readFileSync(resolve(root,'firebase.pruefung.json'),'utf8'));
    const paths=validateRulesConfig(production,emulator);
    const sources=Object.create(null);
    for (const file of Object.values(paths)) {
      const absolute=resolve(root,file);
      if (!absolute.startsWith(root+'/') || !lstatSync(absolute).isFile())
        throw new Error('unsafe_rule_path');
      sources[file]=readFileSync(absolute,'utf8');
    }
    process.stdout.write(JSON.stringify(buildRulesEvidence(production,emulator,sources))+'\n');
  } catch (e) {
    process.stderr.write('BLOCKED: Rules source evidence unavailable ('+
      (e instanceof Error?e.message:'unknown')+')\n');
    process.exitCode=1;
  }
}

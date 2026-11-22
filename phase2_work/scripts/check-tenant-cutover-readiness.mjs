import { createHash, timingSafeEqual } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERDICT = Object.freeze({
  ELIGIBLE: 'ELIGIBLE_FOR_INDEPENDENT_REVIEW',
  BLOCKED: 'BLOCKED',
});
const SHA = /^[a-f0-9]{40}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const ROLES = ['APPSEC', 'DPO_LEGAL', 'BACKEND_SRE', 'RELEASE_OWNER'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const refs = (section, name, ids, errors) => {
  if (!record(section) || !Array.isArray(section.evidenceArtifactIds) || !section.evidenceArtifactIds.length) {
    errors.push(name + ' must reference verified evidence artifacts');
    return;
  }
  for (const id of section.evidenceArtifactIds) if (!ids.has(id)) errors.push(name + ' references unknown evidence');
};
function artifactPath(root, relative) {
  if (!nonempty(relative) || path.isAbsolute(relative)) throw new Error('artifact path must be relative');
  const segments = relative.split(/[\\/]+/);
  if (segments.some(x => !x || x === '.' || x === '..')) throw new Error('unsafe artifact path');
  const realRoot = realpathSync(root);
  let cursor = realRoot;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    if (lstatSync(cursor).isSymbolicLink()) throw new Error('symlink evidence is not allowed');
  }
  const realFile = realpathSync(cursor);
  const relativeToRoot = path.relative(realRoot, realFile);
  if (!relativeToRoot || relativeToRoot === '..' || relativeToRoot.startsWith('..' + path.sep) || path.isAbsolute(relativeToRoot)) {
    throw new Error('artifact escapes evidence root');
  }
  const stat = lstatSync(realFile);
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error('artifact must be a regular file <= 10 MiB');
  return realFile;
}
function checkArtifacts(manifest, root, errors) {
  const list = manifest.evidenceArtifacts;
  if (!Array.isArray(list) || !list.length || list.length > 250) {
    errors.push('evidenceArtifacts must contain 1..250 artifacts');
    return new Set();
  }
  const ids = new Set();
  for (const [i, item] of list.entries()) {
    const label = 'evidenceArtifacts[' + i + ']';
    if (!record(item) || !nonempty(item.id) || ids.has(item.id)) {
      errors.push(label + ' requires a unique id');
      continue;
    }
    ids.add(item.id);
    if (!SHA256.test(item.sha256 || '')) {
      errors.push(label + ' requires a 64-hex SHA-256');
      continue;
    }
    try {
      const digest = createHash('sha256').update(readFileSync(artifactPath(root, item.path))).digest();
      const expected = Buffer.from(item.sha256, 'hex');
      if (digest.length !== expected.length || !timingSafeEqual(digest, expected)) errors.push(label + ' checksum mismatch');
    } catch (error) {
      errors.push(label + ' cannot be verified: ' + error.message);
    }
  }
  return ids;
}
function checkBaseline(m, codeSha, rulesSha, errors) {
  if (!record(m.baseline)) {
    errors.push('baseline is required');
    return;
  }
  if (!SHA.test(codeSha || '') || !SHA.test(rulesSha || '')) errors.push('both exact expected Git SHAs are required');
  if (!SHA.test(m.baseline.codeSha || '') || m.baseline.codeSha !== codeSha) errors.push('code SHA missing or mismatched');
  if (!SHA.test(m.baseline.rulesBaselineSha || '') || m.baseline.rulesBaselineSha !== rulesSha) errors.push('Rules baseline SHA missing or mismatched');
}
function checkMapping(m, ids, errors) {
  const section = m.ownerParticipantMappingEvidence;
  if (!record(section)) { errors.push('ownerParticipantMappingEvidence required'); return; }
  if (section.complete !== true || section.automaticTenantAssignmentUsed !== false
    || section.assignmentMode !== 'REVIEWED_EVIDENCE_ONLY'
    || !Number.isInteger(section.reviewedRecordCount) || section.reviewedRecordCount < 1) {
    errors.push('mapping must be complete, reviewed-only, explicitly non-automatic and counted');
  }
  refs(section, 'ownerParticipantMappingEvidence', ids, errors);
  if (!Array.isArray(section.records) || section.records.length !== section.reviewedRecordCount || !section.records.length) {
    errors.push('records must exactly cover reviewedRecordCount');
    return;
  }
  const seen = new Set();
  for (const [i, row] of section.records.entries()) {
    const label = 'records[' + i + ']';
    if (!record(row) || !nonempty(row.recordRef) || seen.has(row.recordRef)) {
      errors.push(label + ' requires a unique opaque recordRef');
      continue;
    }
    seen.add(row.recordRef);
    const mapped = row.disposition === 'MAPPED';
    const unmapped = row.disposition === 'UNMAPPED';
    const ambiguous = ['AMBIGUOUS', 'CONTRADICTORY', 'ORPHANED', 'DUPLICATE'].includes(row.classification);
    if (!mapped && !unmapped) errors.push(label + ' disposition must be MAPPED or UNMAPPED');
    if (!['CLEAR', 'AMBIGUOUS', 'CONTRADICTORY', 'ORPHANED', 'DUPLICATE'].includes(row.classification)
      || (mapped && row.classification !== 'CLEAR')) errors.push(label + ' classification is invalid');
    if (row.ownerEvidenceReviewed !== true || row.participantsEvidenceReviewed !== true
      || !record(row.owner) || !['VERIFIED', 'UNRESOLVED'].includes(row.owner.status)
      || !Array.isArray(row.participants)
      || row.participants.some(p => !record(p) || !['VERIFIED', 'UNRESOLVED'].includes(p.status))) {
      errors.push(label + ' must account for reviewed owner and participant evidence');
    }
    if (ambiguous && (!unmapped || row.tenantId !== null || row.quarantined !== true)) errors.push(label + ' ambiguous rows must remain tenantless UNMAPPED and quarantined');
    if (unmapped) {
      if (row.tenantId !== null || row.quarantined !== true || !nonempty(row.reasonCode)) errors.push(label + ' UNMAPPED row requires null tenant, quarantine and reason');
      refs({evidenceArtifactIds:row.quarantineEvidenceArtifactIds}, label + ' quarantine', ids, errors);
    }
    if (mapped) {
      if (!nonempty(row.tenantId) || row.quarantined !== false) errors.push(label + ' MAPPED row requires tenantId and quarantined:false');
      if (row.owner?.status !== 'VERIFIED' || !nonempty(row.owner.subjectRef)) errors.push(label + ' requires verified owner evidence');
      if (!Array.isArray(row.participants) || !row.participants.length
        || row.participants.some(p => p?.status !== 'VERIFIED' || !nonempty(p.subjectRef))) errors.push(label + ' requires complete verified participants');
    }
  }
}
function checkArt17(m, ids, errors) {
  const a = m.art17Evidence;
  if (!record(a)) { errors.push('art17Evidence required'); return; }
  for (const [section, field] of [
    ['cascade','documented'],['cascade','tested'],['retention','documented'],['retention','expiryTested'],
    ['legalHold','documented'],['legalHold','precedenceTested'],
    ['storageObjectRelationships','documented'],['storageObjectRelationships','reconciled'],
  ]) if (a[section]?.[field] !== true) errors.push('art17Evidence.' + section + '.' + field + ' must be true');
  if (a.independentAssessment?.status !== 'PASS' || !nonempty(a.independentAssessment.reviewer)
    || a.independentAssessment.auditedSha !== m.baseline?.codeSha) errors.push('independent Art.17 PASS must bind to code SHA');
  refs(a, 'art17Evidence', ids, errors);
}
function checkRollback(m, ids, errors) {
  const r = m.rollbackEvidence;
  if (!record(r)) { errors.push('rollbackEvidence required'); return; }
  if (r.tested !== true || r.testedOnSha !== m.baseline?.codeSha) errors.push('rollback test must bind to code SHA');
  const d = r.defaultOffInterlock;
  if (d?.verified !== true || d.strictTrueOnly !== true || d.disabledStatus !== 503
    || d.resolverCallsWhenDisabled !== 0 || d.storeCallsWhenDisabled !== 0) errors.push('Default-OFF must prove strict true, 503 and zero resolver/store calls');
  if (!Array.isArray(r.stopConditions) || r.stopConditions.length < 2
    || r.stopConditions.some(x => !record(x) || !nonempty(x.condition) || !nonempty(x.responsible) || !nonempty(x.action))) errors.push('at least two named actionable stop conditions required');
  const people = r.responsibilities;
  if (!record(people) || ['incidentCommander','backendSre','dpoLegal','releaseOwner'].some(k => !nonempty(people[k]))) errors.push('named rollback responsibilities required');
  refs(r, 'rollbackEvidence', ids, errors);
}
function checkSignoffs(m, ids, errors) {
  if (!Array.isArray(m.signoffs)) { errors.push('four sign-offs required'); return; }
  const roles = new Set();
  for (const [i, s] of m.signoffs.entries()) {
    if (!record(s) || !ROLES.includes(s.role) || roles.has(s.role)) { errors.push('signoffs['+i+'] role invalid or duplicate'); continue; }
    roles.add(s.role);
    if (s.status !== 'APPROVED' || s.auditedSha !== m.baseline?.codeSha || !nonempty(s.signer)
      || !nonempty(s.signedAt) || !Number.isFinite(Date.parse(s.signedAt))) errors.push('signoffs['+i+'] incomplete or SHA-mismatched');
    refs(s, 'signoffs['+i+']', ids, errors);
  }
  for (const role of ROLES) if (!roles.has(role)) errors.push('missing ' + role + ' sign-off');
}
export function validateCutoverReadiness({manifest, manifestDirectory, expectedCodeSha, expectedRulesBaselineSha} = {}) {
  const errors = [];
  if (!record(manifest)) return Object.freeze({verdict:VERDICT.BLOCKED,blockers:['manifest must be a JSON object']});
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (!nonempty(manifestDirectory)) errors.push('manifestDirectory required for local artifact verification');
  checkBaseline(manifest, expectedCodeSha, expectedRulesBaselineSha, errors);
  const ids = nonempty(manifestDirectory) ? checkArtifacts(manifest, manifestDirectory, errors) : new Set();
  checkMapping(manifest, ids, errors);
  checkArt17(manifest, ids, errors);
  checkRollback(manifest, ids, errors);
  checkSignoffs(manifest, ids, errors);
  return Object.freeze({verdict:errors.length ? VERDICT.BLOCKED : VERDICT.ELIGIBLE,blockers:Object.freeze(errors)});
}
function cliArgs(argv) {
  const args = new Map();
  for (let i=0;i<argv.length;i+=2) {
    const key=argv[i], value=argv[i+1];
    if (!['--manifest','--expected-code-sha','--expected-rules-baseline-sha'].includes(key) || !nonempty(value) || value.startsWith('--') || args.has(key)) throw new Error('invalid or duplicate CLI argument: '+key);
    args.set(key,value);
  }
  for (const key of ['--manifest','--expected-code-sha','--expected-rules-baseline-sha']) if (!args.has(key)) throw new Error('required CLI argument missing: '+key);
  return args;
}
function runCli() {
  try {
    const a=cliArgs(process.argv.slice(2)), manifestPath=path.resolve(a.get('--manifest'));
    const result=validateCutoverReadiness({manifest:JSON.parse(readFileSync(manifestPath,'utf8')),manifestDirectory:path.dirname(manifestPath),expectedCodeSha:a.get('--expected-code-sha'),expectedRulesBaselineSha:a.get('--expected-rules-baseline-sha')});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if (result.verdict===VERDICT.BLOCKED) process.exitCode=2;
  } catch(error) {
    process.stdout.write(JSON.stringify({verdict:VERDICT.BLOCKED,blockers:[error.message]},null,2)+'\n');
    process.exitCode=2;
  }
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) runCli();

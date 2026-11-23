import { createHash, timingSafeEqual } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERDICT=Object.freeze({ELIGIBLE:'ELIGIBLE_FOR_INDEPENDENT_REVIEW',BLOCKED:'BLOCKED'});
const SHA=/^[a-f0-9]{40}$/i, SHA256=/^[a-f0-9]{64}$/i;
const ROLES=['APPSEC','DPO_LEGAL','SRE','RELEASE_OWNER'];
const CONFLICTS=['missingObjects','contradictoryReferences','generationMismatches','metagenerationMismatches','invalidRecords'];
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nonempty=v=>typeof v==='string'&&v.trim().length>0;
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(isRecord(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
const sha256=v=>createHash('sha256').update(v).digest('hex');
function gitBlobSha(v){const b=Buffer.from(v);return createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');}
function safePath(root,relative){
 if(!nonempty(relative)||path.isAbsolute(relative))throw new Error('artifact path must be relative');
 const parts=relative.split(/[\\/]+/);if(parts.some(x=>!x||x==='.'||x==='..'))throw new Error('unsafe artifact path');
 const base=realpathSync(root);let cursor=base;
 for(const part of parts){cursor=path.join(cursor,part);if(lstatSync(cursor).isSymbolicLink())throw new Error('symlink evidence is not allowed');}
 const real=realpathSync(cursor),rel=path.relative(base,real),stat=lstatSync(real);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw new Error('artifact escapes evidence root');
 if(!stat.isFile()||stat.size>10*1024*1024)throw new Error('artifact must be a regular file <= 10 MiB');
 return real;
}
function checkArtifacts(m,root,errors){
 if(!Array.isArray(m.evidenceArtifacts)||m.evidenceArtifacts.length<7||m.evidenceArtifacts.length>100){errors.push('evidenceArtifacts must contain 7..100 independently hashed artifacts');return new Map();}
 const ids=new Map(),paths=new Set();
 for(const [i,item] of m.evidenceArtifacts.entries()){
  const label='evidenceArtifacts['+i+']';
  if(!isRecord(item)||!nonempty(item.id)||ids.has(item.id)||!nonempty(item.path)||paths.has(item.path)){errors.push(label+' requires unique id and path');continue;}
  ids.set(item.id,item);paths.add(item.path);
  if(!SHA256.test(item.sha256||'')||!SHA.test(item.gitBlobSha||'')){errors.push(label+' requires SHA-256 and Git blob SHA-1');continue;}
  try{const body=readFileSync(safePath(root,item.path)),digest=createHash('sha256').update(body).digest(),expected=Buffer.from(item.sha256,'hex');
   if(digest.length!==expected.length||!timingSafeEqual(digest,expected))errors.push(label+' SHA-256 mismatch');
   if(gitBlobSha(body)!==item.gitBlobSha)errors.push(label+' Git blob SHA mismatch');
  }catch(e){errors.push(label+' cannot be verified: '+e.message);}
 }
 return ids;
}
function readArtifact(root,item,errors,label){if(!item){errors.push(label+' evidence artifact is missing');return null;}try{return readFileSync(safePath(root,item.path),'utf8');}catch(e){errors.push(label+' artifact cannot be read: '+e.message);return null;}}
function requireArtifact(ids,id,kind,errors){const a=ids.get(id);if(!a){errors.push('required evidence artifact missing: '+id);return null;}if(a.kind!==kind)errors.push(id+' artifact kind must be '+kind);return a;}
function checkBaseline(m,expectedSha,expectedTree,ids,errors){
 const b=m.baseline;if(!isRecord(b)){errors.push('baseline is required');return;}
 if(!SHA.test(expectedSha||'')||b.mainSha!==expectedSha)errors.push('exact expected main SHA missing or mismatched');
 if(!SHA.test(expectedTree||'')||b.mainTreeSha!==expectedTree)errors.push('exact expected main tree SHA missing or mismatched');
 const fields=['package1SourceGitBlobSha','package2SourceGitBlobSha','package3CandidateRulesGitBlobSha','activeStorageRulesGitBlobSha','firebaseConfigGitBlobSha'];
 if(fields.some(k=>!SHA.test(b[k]||'')))errors.push('baseline requires exact Package 1-3, active Rules and Firebase Git blob SHAs');
 for(const [id,field] of [['package1Source','package1SourceGitBlobSha'],['package2Source','package2SourceGitBlobSha'],['candidateRules','package3CandidateRulesGitBlobSha'],['activeStorageRules','activeStorageRulesGitBlobSha'],['firebaseConfig','firebaseConfigGitBlobSha']])if(!ids.get(id)||ids.get(id).gitBlobSha!==b[field])errors.push('baseline '+field+' missing or mismatched');
}
function checkPackage1(m,ids,root,errors){
 const p=m.package1;if(!isRecord(p)||p.status!=='VERIFIED_DEFAULT_OFF'){errors.push('Package 1 baseline must be VERIFIED_DEFAULT_OFF');return;}
 const src=requireArtifact(ids,'package1Source','package1-source',errors);
 if(p.sourceGitBlobSha!==src?.gitBlobSha)errors.push('Package 1 source SHA missing or mismatched');
 const d=p.defaultOffProof;
 if(!isRecord(d)||d.enabledValue!==false||d.disabledStatus!==503||d.downstreamCallsWhenDisabled!==0||d.routeMounted!==false||d.evidenceArtifactId!=='package1Source')errors.push('Package 1 Default-OFF proof must show false/503/zero downstream calls/unmounted route');
 const body=src?readArtifact(root,src,errors,'Package 1'):null;
 if(body&&(!body.includes('serverConfig?.enabled === true')||!body.includes('profile_media_delivery_disabled')))errors.push('Package 1 source does not prove strict-true Default-OFF behavior');
}
function checkPackage2(m,ids,root,errors){
 const p=m.package2;if(!isRecord(p)||p.status!=='VERIFIED_OFFLINE_DRY_RUN'){errors.push('Package 2 must be VERIFIED_OFFLINE_DRY_RUN');return;}
 const src=requireArtifact(ids,'package2Source','package2-source',errors),planItem=requireArtifact(ids,'package2Plan','package2-dry-run-plan',errors);
 if(p.sourceGitBlobSha!==src?.gitBlobSha)errors.push('Package 2 source SHA missing or mismatched');
 if(p.planArtifactId!=='package2Plan'||!SHA256.test(p.manifestDigest||'')||!SHA256.test(p.planDigest||''))errors.push('Package 2 plan artifact and manifest/plan digests are required');
 const counts=p.counts,conflicts=p.conflicts,keys=['objects','references','eligibleForReview','tokenMetadataPresent','alreadyAbsent','missingObjects','contradictoryReferences','generationMismatches','metagenerationMismatches','invalidRecords'];
 if(!isRecord(counts)||keys.some(k=>!Number.isSafeInteger(counts[k])||counts[k]<0))errors.push('Package 2 inventory counts must be explicit non-negative integers');
 if(!isRecord(conflicts)||CONFLICTS.some(k=>conflicts[k]!==0))errors.push('Package 2 conflict counters must all be explicit zeroes');
 if(p.storageMutations!==0||p.databaseWrites!==0)errors.push('Package 2 mutation counters must be exactly zero');
 if(isRecord(counts)&&(counts.eligibleForReview>counts.objects||counts.tokenMetadataPresent>counts.objects||counts.alreadyAbsent>counts.objects||counts.eligibleForReview!==counts.tokenMetadataPresent))errors.push('Package 2 inventory counts are internally inconsistent');
 const text=planItem?readArtifact(root,planItem,errors,'Package 2 plan'):null;
 if(text){try{const plan=JSON.parse(text);const calculatedPlanDigest=sha256(JSON.stringify({version:1,manifestDigest:plan.manifestDigest,counts:plan.counts,conflicts:plan.conflicts}));if(plan.version!==1||plan.manifestDigest!==p.manifestDigest||plan.planDigest!==p.planDigest||plan.planDigest!==calculatedPlanDigest||canonical(plan.counts)!==canonical(counts)||canonical(plan.conflicts)!==canonical(conflicts)||plan.storageMutations!==0||plan.databaseWrites!==0)errors.push('Package 2 dry-run plan does not match verified manifest, counts or zero-mutation counters');}catch{errors.push('Package 2 dry-run plan is not valid JSON');}}
 const body=src?readArtifact(root,src,errors,'Package 2 source'):null;
 if(body&&(!body.includes('createProfileMediaTokenDryRunPlan')||!/storageMutations\s*:\s*0/.test(body)||!/databaseWrites\s*:\s*0/.test(body)))errors.push('Package 2 source does not prove the offline zero-mutation planner contract');
}
function checkPackage3(m,ids,root,errors){
 const p=m.package3;if(!isRecord(p)||p.status!=='ISOLATED_CANDIDATE_DEFAULT_DENY'){errors.push('Package 3 must be ISOLATED_CANDIDATE_DEFAULT_DENY');return;}
 const candidate=requireArtifact(ids,'candidateRules','candidate-storage-rules',errors),active=requireArtifact(ids,'activeStorageRules','active-storage-rules',errors),config=requireArtifact(ids,'firebaseConfig','firebase-config',errors);
 if(!nonempty(p.candidateRulesPath)||p.candidateRulesPath!==candidate?.path||p.candidateRulesPath===p.activeRulesPath||p.activeRulesPath!=='storage.rules'||active?.path!==p.activeRulesPath)errors.push('candidate and active Storage Rules paths must be distinct; active path must remain storage.rules');
 const body=candidate?readArtifact(root,candidate,errors,'Candidate Rules'):null;
 if(body&&(!body.includes('allow read, write: if false')||!body.includes('match /{object=**}')))errors.push('candidate Rules must retain explicit deny and recursive default-deny');
 const configBody=config?readArtifact(root,config,errors,'Firebase config'):null;
 if(configBody){try{const parsed=JSON.parse(configBody);if(parsed.storage?.rules!=='storage.rules'||configBody.includes(p.candidateRulesPath))errors.push('firebase.json must reference only active storage.rules and never candidate Rules');}catch{errors.push('firebase.json evidence is not valid JSON');}}
 if(candidate&&active&&candidate.gitBlobSha===active.gitBlobSha)errors.push('candidate Rules must not alias active Rules');
}
function checkRisks(m,ids,errors){
 const t=m.persistentTokenRisk;
 if(!isRecord(t)||t.status!=='ASSESSED_AND_SEPARATELY_GATED'||t.unresolvedCount!==0||t.liveStateVerified!==false||t.liveRevocationPerformed!==false||t.separateLiveOperationRequired!==true||t.evidenceArtifactId!=='package2Plan')errors.push('persistent token-URL risk must be assessed, unresolved offline findings zero, live state unverified and revocation separately gated');
 const l=m.legacyPhotoUrlRisk;
 if(!isRecord(l)||l.inventoryStatus!=='OFFLINE_INVENTORY_COMPLETE'||l.scope!=='SYNTHETIC_ONLY'||l.unresolvedCount!==0||l.privacyAssessment!=='PASS'||l.liveDataAccessed!==false||l.migrationPerformed!==false||l.separateMigrationRequired!==true||l.evidenceArtifactId!=='package2Plan')errors.push('legacy photoURL evidence must be synthetic/offline, privacy-reviewed and explicitly non-migrating');
 if(!ids.has('package2Plan'))errors.push('token and legacy-risk evidence must bind to Package 2 dry-run artifact');
}
function checkRollback(m,ids,root,errors){
 const r=m.rollback;
 if(!isRecord(r)||r.status!=='DOCUMENTED_AND_SYNTHETICALLY_TESTED'||r.defaultOffBaselineVerified!==true||r.activeRulesUnchanged!==true||r.runtimeBaselineUnchanged!==true||r.testedOnMainSha!==m.baseline?.mainSha)errors.push('rollback must bind tested Default-OFF and unchanged active Rules/runtime baselines to exact main SHA');
 if(!Array.isArray(r?.triggers)||r.triggers.length<2||r.triggers.some(x=>!isRecord(x)||!nonempty(x.condition)||!nonempty(x.owner)||!nonempty(x.action)))errors.push('rollback requires at least two explicit triggers with owner and stop action');
 if(!isRecord(r?.owners)||['incidentCommander','appSec','dpoLegal','sre','releaseOwner'].some(k=>!nonempty(r.owners[k])))errors.push('rollback requires incident, AppSec, DPO/Legal, SRE and Release Owner responsibilities');
 const a=requireArtifact(ids,'rollbackEvidence','rollback-evidence',errors);
 if(r?.evidenceArtifactId!=='rollbackEvidence'||!a)errors.push('rollback recovery evidence must be referenced');
 const body=a?readArtifact(root,a,errors,'Rollback'):null;
 if(body&&(!body.includes('DEFAULT_OFF')||!body.includes('NO_MUTATION')||!body.includes('RECOVERY_REHEARSAL')))errors.push('rollback evidence must record Default-OFF, no mutation and recovery rehearsal');
}
function checkApprovals(m,errors){
 if(!Array.isArray(m.approvals)||m.approvals.length!==ROLES.length){errors.push('exactly four independent role approvals are required');return;}
 const roles=new Set(),signers=new Set();
 for(const [i,a] of m.approvals.entries()){
  if(!isRecord(a)||!ROLES.includes(a.role)||roles.has(a.role)){errors.push('approvals['+i+'] role invalid or duplicated');continue;}
  roles.add(a.role);
  if(!nonempty(a.signerRef)||signers.has(a.signerRef))errors.push('approval signer references must be distinct and non-empty');
  signers.add(a.signerRef);
  if(a.disposition!=='APPROVED'||a.evidenceDigest!==m.evidenceDigest||!iso(a.signedAt))errors.push('approvals['+i+'] must be APPROVED, timestamped and bound to exact evidence digest');
 }
 for(const role of ROLES)if(!roles.has(role))errors.push('missing '+role+' approval');
}
export function computeEvidenceDigest(m){if(!isRecord(m))throw new Error('manifest must be an object');const unsigned={...m};delete unsigned.approvals;delete unsigned.evidenceDigest;return sha256(canonical(unsigned));}
export function validateProfileMediaCutoverReadiness({manifest,manifestDirectory,expectedMainSha,expectedMainTreeSha}={}){
 const errors=[];if(!isRecord(manifest))return Object.freeze({verdict:VERDICT.BLOCKED,blockers:['manifest must be a JSON object']});
 if(manifest.schemaVersion!==1)errors.push('schemaVersion must equal 1');
 if(!nonempty(manifestDirectory))errors.push('manifestDirectory required for local artifact verification');
 let ids=new Map();
 if(nonempty(manifestDirectory)){try{ids=checkArtifacts(manifest,manifestDirectory,errors);}catch(e){errors.push('evidence root cannot be verified: '+e.message);}}else errors.push('evidence artifacts cannot be verified without a local evidence directory');
 checkBaseline(manifest,expectedMainSha,expectedMainTreeSha,ids,errors);checkPackage1(manifest,ids,manifestDirectory,errors);checkPackage2(manifest,ids,manifestDirectory,errors);checkPackage3(manifest,ids,manifestDirectory,errors);checkRisks(manifest,ids,errors);checkRollback(manifest,ids,manifestDirectory,errors);
 if(!SHA256.test(manifest.evidenceDigest||'')||manifest.evidenceDigest!==computeEvidenceDigest(manifest))errors.push('evidence digest missing or mismatched');
 checkApprovals(manifest,errors);
 return Object.freeze({verdict:errors.length?VERDICT.BLOCKED:VERDICT.ELIGIBLE,blockers:Object.freeze(errors)});
}
function cliArgs(argv){
 const args=new Map();for(let i=0;i<argv.length;i+=2){const k=argv[i],v=argv[i+1];if(!['--manifest','--expected-main-sha','--expected-main-tree-sha'].includes(k)||!nonempty(v)||v.startsWith('--')||args.has(k))throw new Error('invalid or duplicate CLI argument: '+k);args.set(k,v);}
 for(const k of ['--manifest','--expected-main-sha','--expected-main-tree-sha'])if(!args.has(k))throw new Error('required CLI argument missing: '+k);
 if(!SHA.test(args.get('--expected-main-sha'))||!SHA.test(args.get('--expected-main-tree-sha')))throw new Error('expected main SHA and tree SHA must be 40-hex Git object IDs');
 return args;
}
function runCli(){try{const a=cliArgs(process.argv.slice(2)),manifestPath=path.resolve(a.get('--manifest'));const result=validateProfileMediaCutoverReadiness({manifest:JSON.parse(readFileSync(manifestPath,'utf8')),manifestDirectory:path.dirname(manifestPath),expectedMainSha:a.get('--expected-main-sha'),expectedMainTreeSha:a.get('--expected-main-tree-sha')});process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.verdict===VERDICT.BLOCKED)process.exitCode=2;}catch(e){process.stdout.write(JSON.stringify({verdict:VERDICT.BLOCKED,blockers:[e.message]},null,2)+'\n');process.exitCode=2;}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runCli();

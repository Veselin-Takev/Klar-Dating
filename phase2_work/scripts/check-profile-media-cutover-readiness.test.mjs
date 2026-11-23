import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { VERDICT, computeEvidenceDigest, validateProfileMediaCutoverReadiness } from './check-profile-media-cutover-readiness.mjs';

const MAIN='a'.repeat(40),TREE='b'.repeat(40);
const P1='export const enabled = serverConfig?.enabled === true;\nprofile_media_delivery_disabled\n';
const P2='createProfileMediaTokenDryRunPlan\nstorageMutations: 0\ndatabaseWrites: 0\n';
const CANDIDATE='match /profile-media/v1/{id} { allow read, write: if false; }\nmatch /{object=**} { allow read, write: if false; }\n';
const ACTIVE='rules_version = "2";\n// unchanged active baseline\n';
const FIREBASE=JSON.stringify({storage:{rules:'storage.rules'},firestore:{rules:'firestore.rules'}},null,2);
const ROLLBACK='DEFAULT_OFF\nNO_MUTATION\nRECOVERY_REHEARSAL\n';
const COUNTS={objects:2,references:2,eligibleForReview:1,tokenMetadataPresent:1,alreadyAbsent:1,missingObjects:0,contradictoryReferences:0,generationMismatches:0,metagenerationMismatches:0,invalidRecords:0};
const CONFLICTS={missingObjects:0,contradictoryReferences:0,generationMismatches:0,metagenerationMismatches:0,invalidRecords:0};
function blob(body){const b=Buffer.from(body);return createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');}
function add(dir,id,file,kind,body){writeFileSync(path.join(dir,file),body,{flag:'wx'});return{id,path:file,kind,sha256:createHash('sha256').update(body).digest('hex'),gitBlobSha:blob(body)};}
function makeFixture(mutator=()=>{}){
 const dir=mkdtempSync(path.join(os.tmpdir(),'klar-profile-media-cutover-'));mkdirSync(dir,{recursive:true});
 try{
  const artifacts=[add(dir,'package1Source','package1.ts','package1-source',P1),add(dir,'package2Source','package2.ts','package2-source',P2),add(dir,'package2Plan','package2-plan.json','package2-dry-run-plan',''),add(dir,'candidateRules','storage.p0-374-candidate.rules','candidate-storage-rules',CANDIDATE),add(dir,'activeStorageRules','storage.rules','active-storage-rules',ACTIVE),add(dir,'firebaseConfig','firebase.json','firebase-config',FIREBASE),add(dir,'rollbackEvidence','rollback.txt','rollback-evidence',ROLLBACK)];
  const plan={version:1,manifestDigest:'c'.repeat(64),planDigest:'',counts:COUNTS,conflicts:CONFLICTS,storageMutations:0,databaseWrites:0};plan.planDigest=createHash('sha256').update(JSON.stringify({version:1,manifestDigest:plan.manifestDigest,counts:plan.counts,conflicts:plan.conflicts})).digest('hex');
  const planText=JSON.stringify(plan);writeFileSync(path.join(dir,'package2-plan.json'),planText);artifacts[2].sha256=createHash('sha256').update(planText).digest('hex');artifacts[2].gitBlobSha=blob(planText);
  const m={schemaVersion:1,baseline:{mainSha:MAIN,mainTreeSha:TREE,package1SourceGitBlobSha:artifacts[0].gitBlobSha,package2SourceGitBlobSha:artifacts[1].gitBlobSha,package3CandidateRulesGitBlobSha:artifacts[3].gitBlobSha,activeStorageRulesGitBlobSha:artifacts[4].gitBlobSha,firebaseConfigGitBlobSha:artifacts[5].gitBlobSha},evidenceArtifacts:artifacts,
   package1:{status:'VERIFIED_DEFAULT_OFF',sourceGitBlobSha:artifacts[0].gitBlobSha,defaultOffProof:{enabledValue:false,disabledStatus:503,downstreamCallsWhenDisabled:0,routeMounted:false,evidenceArtifactId:'package1Source'}},
   package2:{status:'VERIFIED_OFFLINE_DRY_RUN',sourceGitBlobSha:artifacts[1].gitBlobSha,manifestDigest:plan.manifestDigest,planDigest:plan.planDigest,counts:COUNTS,conflicts:CONFLICTS,storageMutations:0,databaseWrites:0,planArtifactId:'package2Plan'},
   package3:{status:'ISOLATED_CANDIDATE_DEFAULT_DENY',candidateRulesPath:'storage.p0-374-candidate.rules',activeRulesPath:'storage.rules'},
   persistentTokenRisk:{status:'ASSESSED_AND_SEPARATELY_GATED',unresolvedCount:0,liveStateVerified:false,liveRevocationPerformed:false,separateLiveOperationRequired:true,evidenceArtifactId:'package2Plan'},
   legacyPhotoUrlRisk:{inventoryStatus:'OFFLINE_INVENTORY_COMPLETE',scope:'SYNTHETIC_ONLY',unresolvedCount:0,privacyAssessment:'PASS',liveDataAccessed:false,migrationPerformed:false,separateMigrationRequired:true,evidenceArtifactId:'package2Plan'},
   rollback:{status:'DOCUMENTED_AND_SYNTHETICALLY_TESTED',defaultOffBaselineVerified:true,activeRulesUnchanged:true,runtimeBaselineUnchanged:true,testedOnMainSha:MAIN,triggers:[{condition:'unexpected direct client access',owner:'AppSec',action:'stop; preserve Default-OFF'},{condition:'evidence digest mismatch',owner:'Release Owner',action:'stop; restore baseline'}],owners:{incidentCommander:'Incident Commander',appSec:'AppSec Owner',dpoLegal:'DPO/Legal Owner',sre:'SRE Owner',releaseOwner:'Release Owner'},evidenceArtifactId:'rollbackEvidence'},
   approvals:['APPSEC','DPO_LEGAL','SRE','RELEASE_OWNER'].map(role=>({role,disposition:'APPROVED',signerRef:'synthetic-reviewer-'+role,evidenceDigest:'',signedAt:'2026-11-23T12:00:00Z'}))};
  mutator(m,dir,artifacts);m.evidenceDigest=computeEvidenceDigest(m);for(const a of m.approvals)a.evidenceDigest=m.evidenceDigest;return{dir,manifest:m,artifacts};
 }catch(e){rmSync(dir,{recursive:true,force:true});throw e;}
}
function fixture(fn){const {dir,manifest,artifacts}=makeFixture();try{fn(dir,manifest,artifacts);}finally{rmSync(dir,{recursive:true,force:true});}}
const run=(dir,m,sha=MAIN,tree=TREE)=>validateProfileMediaCutoverReadiness({manifest:m,manifestDirectory:dir,expectedMainSha:sha,expectedMainTreeSha:tree});
const blocked=r=>{assert.equal(r.verdict,VERDICT.BLOCKED);assert.ok(r.blockers.length);};

test('positive synthetic evidence is eligible only for independent review',()=>fixture((dir,m)=>{const r=run(dir,m);assert.deepEqual(r,{verdict:VERDICT.ELIGIBLE,blockers:[]});assert.notEqual(r.verdict,'PRODUCTION_APPROVED');assert.equal('productionApproved' in r,false);}));
test('missing and mismatched Package 1 source SHA blocks',()=>fixture((d,m)=>{m.package1.sourceGitBlobSha='';m.baseline.package1SourceGitBlobSha='f'.repeat(40);blocked(run(d,m));}));
test('missing and mismatched Package 2 source SHA blocks',()=>fixture((d,m)=>{m.package2.sourceGitBlobSha='';m.baseline.package2SourceGitBlobSha='e'.repeat(40);blocked(run(d,m));}));
test('missing or mismatched Package 3 candidate Rules SHA blocks',()=>fixture((d,m)=>{m.baseline.package3CandidateRulesGitBlobSha='f'.repeat(40);blocked(run(d,m));}));
test('wrong exact main SHA or tree identity blocks',()=>fixture((d,m)=>{blocked(run(d,m,'c'.repeat(40)));blocked(run(d,m,MAIN,'d'.repeat(40)));}));
test('Package 1 missing Default-OFF proof or non-zero downstream calls blocks',()=>fixture((d,m)=>{m.package1.defaultOffProof.downstreamCallsWhenDisabled=1;blocked(run(d,m));}));
test('Package 2 missing or unclear inventory counts blocks',()=>fixture((d,m)=>{delete m.package2.counts.references;blocked(run(d,m));}));
test('Package 2 non-zero mutation counters or conflicts block',()=>fixture((d,m)=>{m.package2.storageMutations=1;blocked(run(d,m));}));
test('Package 2 plan digest or artifact mismatch blocks',()=>fixture((d,m)=>{m.package2.planDigest='f'.repeat(64);blocked(run(d,m));}));
test('candidate Rules accidentally active in firebase.json blocks',()=>fixture((d,m,a)=>{const bad=JSON.stringify({storage:{rules:'storage.p0-374-candidate.rules'}});writeFileSync(path.join(d,'firebase.json'),bad);a[5].sha256=createHash('sha256').update(bad).digest('hex');a[5].gitBlobSha=blob(bad);m.baseline.firebaseConfigGitBlobSha=a[5].gitBlobSha;blocked(run(d,m));}));
test('candidate and active Storage Rules identity confusion blocks',()=>fixture((d,m)=>{m.package3.activeRulesPath='storage.p0-374-candidate.rules';blocked(run(d,m));}));
test('unresolved persistent token-URL risk or live revocation claim blocks',()=>fixture((d,m)=>{m.persistentTokenRisk.unresolvedCount=1;blocked(run(d,m));}));
test('unverified token state cannot be represented as live-safe or revoked',()=>fixture((d,m)=>{m.persistentTokenRisk.liveRevocationPerformed=true;blocked(run(d,m));}));
test('unresolved legacy photoURL or missing privacy evidence blocks',()=>fixture((d,m)=>{m.legacyPhotoUrlRisk.unresolvedCount=1;blocked(run(d,m));}));
test('live photoURL access or migration claim blocks',()=>fixture((d,m)=>{m.legacyPhotoUrlRisk.liveDataAccessed=true;blocked(run(d,m));}));
test('missing Default-OFF rollback baseline or unchanged active Rules proof blocks',()=>fixture((d,m)=>{m.rollback.activeRulesUnchanged=false;blocked(run(d,m));}));
test('missing rollback triggers, owners or recovery evidence blocks',()=>fixture((d,m)=>{m.rollback.triggers=[];m.rollback.owners.sre='';blocked(run(d,m));}));
test('missing SHA-256 or Git blob identity blocks',()=>fixture((d,m)=>{m.evidenceArtifacts[0].sha256='';blocked(run(d,m));}));
test('tampered evidence content blocks',()=>fixture((d,m)=>{writeFileSync(path.join(d,'package1.ts'),'changed after digest\n');blocked(run(d,m));}));
test('path traversal in evidence references blocks',()=>fixture((d,m)=>{m.evidenceArtifacts[0].path='../outside.txt';blocked(run(d,m));}));
test('missing, duplicate and mismatched independent approvals block',()=>fixture((d,m)=>{m.approvals=m.approvals.slice(0,3);blocked(run(d,m));m.approvals[3]={...m.approvals[0]};blocked(run(d,m));m.approvals[3]={...m.approvals[3],role:'RELEASE_OWNER',signerRef:'synthetic-other',evidenceDigest:'0'.repeat(64)};blocked(run(d,m));}));
test('approvals must have distinct signers and exact evidence digest',()=>fixture((d,m)=>{m.approvals[1].signerRef=m.approvals[0].signerRef;blocked(run(d,m));}));
test('evidence digest tampering invalidates every approval binding',()=>fixture((d,m)=>{m.package3.status='CANDIDATE_ACTIVATED';blocked(run(d,m));}));
test('malformed manifest and absent evidence directory block',()=>fixture((d,m)=>{blocked(run(d,[]));blocked(validateProfileMediaCutoverReadiness({manifest:m,expectedMainSha:MAIN,expectedMainTreeSha:TREE}));}));
test('symlink evidence is rejected',()=>fixture((d,m)=>{symlinkSync(path.join(d,'package1.ts'),path.join(d,'linked.ts'));m.evidenceArtifacts[0].path='linked.ts';blocked(run(d,m));}));

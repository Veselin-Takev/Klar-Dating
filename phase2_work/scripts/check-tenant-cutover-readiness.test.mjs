import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {VERDICT,validateCutoverReadiness} from './check-tenant-cutover-readiness.mjs';

const CODE='a'.repeat(40), RULES='b'.repeat(40), BODY='synthetic evidence only; no real PII\n';
const DIGEST=createHash('sha256').update(BODY).digest('hex');
const make=()=> {
 const refs=['evidence-1'];
 return {
  schemaVersion:1, baseline:{codeSha:CODE,rulesBaselineSha:RULES},
  evidenceArtifacts:[{id:refs[0],path:'evidence.txt',sha256:DIGEST}],
  ownerParticipantMappingEvidence:{
   complete:true,automaticTenantAssignmentUsed:false,assignmentMode:'REVIEWED_EVIDENCE_ONLY',reviewedRecordCount:3,evidenceArtifactIds:refs,
   records:[
    {recordRef:'mapped',classification:'CLEAR',disposition:'MAPPED',tenantId:'tenant-synthetic',quarantined:false,ownerEvidenceReviewed:true,participantsEvidenceReviewed:true,owner:{status:'VERIFIED',subjectRef:'owner-synthetic'},participants:[{status:'VERIFIED',subjectRef:'participant-synthetic'}]},
    {recordRef:'ambiguous',classification:'AMBIGUOUS',disposition:'UNMAPPED',tenantId:null,quarantined:true,reasonCode:'AMBIGUOUS',ownerEvidenceReviewed:true,participantsEvidenceReviewed:true,quarantineEvidenceArtifactIds:refs,owner:{status:'UNRESOLVED'},participants:[]},
    {recordRef:'contradictory',classification:'CONTRADICTORY',disposition:'UNMAPPED',tenantId:null,quarantined:true,reasonCode:'CONTRADICTORY',ownerEvidenceReviewed:true,participantsEvidenceReviewed:true,quarantineEvidenceArtifactIds:refs,owner:{status:'UNRESOLVED'},participants:[]},
   ]
  },
  art17Evidence:{cascade:{documented:true,tested:true},retention:{documented:true,expiryTested:true},legalHold:{documented:true,precedenceTested:true},storageObjectRelationships:{documented:true,reconciled:true},independentAssessment:{status:'PASS',reviewer:'Synthetic independent reviewer',auditedSha:CODE},evidenceArtifactIds:refs},
  rollbackEvidence:{tested:true,testedOnSha:CODE,defaultOffInterlock:{verified:true,strictTrueOnly:true,disabledStatus:503,resolverCallsWhenDisabled:0,storeCallsWhenDisabled:0},stopConditions:[{condition:'membership mismatch',responsible:'Backend lead',action:'stop and preserve OFF'},{condition:'Art.17 gap',responsible:'DPO lead',action:'stop and quarantine'}],responsibilities:{incidentCommander:'Incident lead',backendSre:'SRE lead',dpoLegal:'DPO lead',releaseOwner:'Release lead'},evidenceArtifactIds:refs},
  signoffs:['APPSEC','DPO_LEGAL','BACKEND_SRE','RELEASE_OWNER'].map(role=>({role,status:'APPROVED',signer:'Synthetic '+role,signedAt:'2026-11-22T20:00:00Z',auditedSha:CODE,evidenceArtifactIds:refs}))
 };
};
function fixture(fn){
 const dir=mkdtempSync(path.join(os.tmpdir(),'klar-cutover-'));
 try{mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'evidence.txt'),BODY,{flag:'wx'});fn(dir,make());}
 finally{rmSync(dir,{recursive:true,force:true});}
}
const run=(dir,manifest,extra={})=>validateCutoverReadiness({manifest,manifestDirectory:dir,expectedCodeSha:CODE,expectedRulesBaselineSha:RULES,...extra});
const blocked=result=>{assert.equal(result.verdict,VERDICT.BLOCKED);assert.ok(result.blockers.length);};

test('positive synthetic manifest is eligible only for independent review',()=>fixture((dir,m)=>{const r=run(dir,m);assert.deepEqual(r,{verdict:VERDICT.ELIGIBLE,blockers:[]});assert.equal('productionApproved' in r,false);}));
test('missing code SHA blocks',()=>fixture((dir,m)=>{delete m.baseline.codeSha;blocked(run(dir,m));}));
test('missing Rules SHA blocks',()=>fixture((dir,m)=>{delete m.baseline.rulesBaselineSha;blocked(run(dir,m));}));
test('mismatched code or Rules SHA blocks',()=>fixture((dir,m)=>{blocked(run(dir,m,{expectedCodeSha:'c'.repeat(40)}));blocked(run(dir,m,{expectedRulesBaselineSha:'d'.repeat(40)}));}));
test('missing SHA-256 blocks',()=>fixture((dir,m)=>{delete m.evidenceArtifacts[0].sha256;blocked(run(dir,m));}));
test('mismatched artifact digest blocks',()=>fixture((dir,m)=>{m.evidenceArtifacts[0].sha256='f'.repeat(64);blocked(run(dir,m));}));
test('unquarantined ambiguous record blocks',()=>fixture((dir,m)=>{m.ownerParticipantMappingEvidence.records[1].quarantined=false;blocked(run(dir,m));}));
test('automatic tenant assignment attempt blocks',()=>fixture((dir,m)=>{m.ownerParticipantMappingEvidence.automaticTenantAssignmentUsed=true;blocked(run(dir,m));}));
test('missing quarantine artifact reference blocks',()=>fixture((dir,m)=>{delete m.ownerParticipantMappingEvidence.records[1].quarantineEvidenceArtifactIds;blocked(run(dir,m));}));
test('missing Art.17 legal-hold evidence blocks',()=>fixture((dir,m)=>{delete m.art17Evidence.legalHold;blocked(run(dir,m));}));
test('mismatched Art.17 reviewer SHA blocks',()=>fixture((dir,m)=>{m.art17Evidence.independentAssessment.auditedSha='c'.repeat(40);blocked(run(dir,m));}));
test('missing Default-OFF proof blocks',()=>fixture((dir,m)=>{m.rollbackEvidence.defaultOffInterlock.disabledStatus=200;blocked(run(dir,m));}));
test('missing rollback responsibilities blocks',()=>fixture((dir,m)=>{m.rollbackEvidence.responsibilities.backendSre='';blocked(run(dir,m));}));
test('missing required sign-off blocks',()=>fixture((dir,m)=>{m.signoffs=m.signoffs.filter(x=>x.role!=='DPO_LEGAL');blocked(run(dir,m));}));
test('mismatched sign-off SHA blocks',()=>fixture((dir,m)=>{m.signoffs[0].auditedSha='c'.repeat(40);blocked(run(dir,m));}));
test('malformed manifest blocks',()=>fixture(dir=>blocked(run(dir,[]))));
test('path traversal blocks',()=>fixture((dir,m)=>{m.evidenceArtifacts[0].path='../outside.txt';blocked(run(dir,m));}));
test('missing evidence directory or expected SHAs blocks',()=>{blocked(validateCutoverReadiness({manifest:make(),expectedCodeSha:CODE,expectedRulesBaselineSha:RULES}));});

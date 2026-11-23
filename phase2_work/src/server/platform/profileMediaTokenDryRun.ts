import { createHash } from 'node:crypto';
export type OfflineMediaObject = { objectPath: string; exists: boolean; generation?: string; metageneration?: string; tokenMetadataPresent: boolean };
export type OfflineMediaReference = { objectPath: string; generation?: string; metageneration?: string };
export type OfflineMediaInventory = { objects: readonly OfflineMediaObject[]; references: readonly OfflineMediaReference[] };
export type DryRunApproval = { role: 'APPSEC' | 'DPO' | 'SRE'; reviewerId: string; manifestDigest: string; approvedAt: string; expiresAt: string };
export type ProfileMediaTokenDryRunPlan = {
 version: 1; manifestDigest: string; planDigest: string;
 counts: { objects: number; references: number; eligibleForReview: number; tokenMetadataPresent: number; alreadyAbsent: number; missingObjects: number; contradictoryReferences: number; generationMismatches: number; metagenerationMismatches: number; invalidRecords: number };
 conflicts: { missingObjects: number; contradictoryReferences: number; generationMismatches: number; metagenerationMismatches: number; invalidRecords: number };
 storageMutations: 0; databaseWrites: 0;
};
const PATH_PATTERN=/^profiles\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_./-]+$/;
const DIGEST_PATTERN=/^[a-f0-9]{64}$/;
const REQUIRED_ROLES=['APPSEC','DPO','SRE'] as const;
function validPath(value:string):boolean{return PATH_PATTERN.test(value)&&!value.includes('\\')&&value.split('/').every(p=>p&&p!=='.'&&p!=='..');}
function validVersion(value:string|undefined):value is string{return typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value);}
function hash(value:string):string{return createHash('sha256').update(value,'utf8').digest('hex');}
function canonicalInventory(inventory:OfflineMediaInventory):string{
 const objects=inventory.objects.map(item=>({objectPath:item.objectPath,exists:item.exists,generation:item.generation??null,metageneration:item.metageneration??null,tokenMetadataPresent:item.tokenMetadataPresent}))
 .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const references=inventory.references.map(item=>({objectPath:item.objectPath,generation:item.generation??null,metageneration:item.metageneration??null}))
 .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return JSON.stringify({version:1,objects,references});
}
/** Pure offline planner: no SDK, filesystem, network, clock or mutation dependency. */
export function createProfileMediaTokenDryRunPlan(inventory:OfflineMediaInventory):ProfileMediaTokenDryRunPlan{
 if(!inventory||!Array.isArray(inventory.objects)||!Array.isArray(inventory.references)||inventory.objects.length>10000||inventory.references.length>50000)throw new Error('Offline inventory is malformed or exceeds its bounded limits.');
 for(const item of inventory.objects)if(!item||typeof item.objectPath!=='string'||!validPath(item.objectPath)||typeof item.exists!=='boolean'||typeof item.tokenMetadataPresent!=='boolean'||(item.generation!==undefined&&!validVersion(item.generation))||(item.metageneration!==undefined&&!validVersion(item.metageneration)))throw new Error('Offline inventory contains an invalid object record.');
 for(const item of inventory.references)if(!item||typeof item.objectPath!=='string'||!validPath(item.objectPath)||(item.generation!==undefined&&!validVersion(item.generation))||(item.metageneration!==undefined&&!validVersion(item.metageneration)))throw new Error('Offline inventory contains an invalid reference record.');
 const manifestDigest=hash(canonicalInventory(inventory));
 const counts={objects:inventory.objects.length,references:inventory.references.length,eligibleForReview:0,tokenMetadataPresent:0,alreadyAbsent:0,missingObjects:0,contradictoryReferences:0,generationMismatches:0,metagenerationMismatches:0,invalidRecords:0};
 const versionsByObject=new Map<string,Set<string>>(),objectByPath=new Map<string,OfflineMediaObject>();
 for(const item of inventory.objects){const v=String(item.generation??'')+':'+String(item.metageneration??'');const s=versionsByObject.get(item.objectPath)??new Set<string>();s.add(v);versionsByObject.set(item.objectPath,s);if(!objectByPath.has(item.objectPath))objectByPath.set(item.objectPath,item);}
 for(const s of versionsByObject.values())if(s.size>1)counts.contradictoryReferences++;
 const refVersions=new Map<string,Set<string>>();
 for(const ref of inventory.references){const v=String(ref.generation??'')+':'+String(ref.metageneration??'');const s=refVersions.get(ref.objectPath)??new Set<string>();s.add(v);refVersions.set(ref.objectPath,s);const object=objectByPath.get(ref.objectPath);if(!object||!object.exists){counts.missingObjects++;continue;}if(ref.generation!==undefined&&ref.generation!==object.generation)counts.generationMismatches++;if(ref.metageneration!==undefined&&ref.metageneration!==object.metageneration)counts.metagenerationMismatches++;}
 for(const [path,s] of refVersions)if(s.size>1&&!versionsByObject.has(path))counts.contradictoryReferences++;
 counts.tokenMetadataPresent=[...objectByPath.values()].filter(o=>o.exists&&o.tokenMetadataPresent).length;
 counts.alreadyAbsent=[...objectByPath.values()].filter(o=>o.exists&&!o.tokenMetadataPresent).length;
 const conflicts={missingObjects:counts.missingObjects,contradictoryReferences:counts.contradictoryReferences,generationMismatches:counts.generationMismatches,metagenerationMismatches:counts.metagenerationMismatches,invalidRecords:counts.invalidRecords};
 counts.eligibleForReview=Object.values(conflicts).every(v=>v===0)?counts.tokenMetadataPresent:0;
 const planDigest=hash(JSON.stringify({version:1,manifestDigest,counts,conflicts}));
 return{version:1,manifestDigest,planDigest,counts,conflicts,storageMutations:0,databaseWrites:0};
}
/** Non-mutating preflight only. This verifier never executes a revocation. */
export function verifyProfileMediaTokenDryRunPlan(plan:ProfileMediaTokenDryRunPlan,currentManifestDigest:string,approvals:readonly DryRunApproval[],now=Date.now()):void{
 if(!plan||plan.version!==1||!DIGEST_PATTERN.test(currentManifestDigest)||plan.manifestDigest!==currentManifestDigest)throw new Error('Dry-run plan is stale or its manifest digest does not match.');
 const digest=hash(JSON.stringify({version:1,manifestDigest:plan.manifestDigest,counts:plan.counts,conflicts:plan.conflicts}));
 if(digest!==plan.planDigest||plan.storageMutations!==0||plan.databaseWrites!==0)throw new Error('Dry-run plan integrity or zero-mutation invariant failed.');
 if(Object.values(plan.conflicts).some(v=>v!==0)||plan.counts.eligibleForReview!==plan.counts.tokenMetadataPresent)throw new Error('Inconsistent inventory or unresolved conflicts block further review.');
 if(!Array.isArray(approvals))throw new Error('Independent approvals are required.');
 const reviewers=new Set<string>(),roles=new Set<string>();
 for(const a of approvals){if(!a||!REQUIRED_ROLES.includes(a.role)||!a.reviewerId||reviewers.has(a.reviewerId)||roles.has(a.role)||a.manifestDigest!==currentManifestDigest||!Number.isFinite(Date.parse(a.approvedAt))||!Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.approvedAt)>now||Date.parse(a.expiresAt)<=now)throw new Error('Independent approvals are missing, duplicated, expired or bound to another manifest.');reviewers.add(a.reviewerId);roles.add(a.role);}
 if(REQUIRED_ROLES.some(role=>!roles.has(role)))throw new Error('Independent AppSec, DPO and SRE approvals are all required.');
}

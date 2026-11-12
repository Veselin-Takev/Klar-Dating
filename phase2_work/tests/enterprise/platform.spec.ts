import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { compatibilityScore } from '../../src/server/platform/compatibility';
import { assessRisk, evaluateAccountRisk } from '../../src/server/platform/riskEngine';
import { sanitizePromptInput } from '../../src/server/platform/privacySanitizer';

test('compatibility rewards aligned goals and values', () => {
  const score = compatibilityScore({ values: ['family','honesty'], relationshipGoals:['long-term'], interests:['hiking'] }, { values:['honesty','family'], relationshipGoals:['long-term'], interests:['hiking'] });
  assert.ok(score >= 90);
});

test('risk engine escalates scam-like signals', () => {
  const result = assessRisk({ accountAgeDays: 1, reportCount: 2, outboundMessages24h: 150, repeatedMessageRatio: .8, externalPaymentMentions: 2 });
  assert.equal(result.level, 'high');
  assert.ok(result.actions.includes('safety_review'));
});

const previousAuthFlag = process.env.KLAR_TENANT_AUTH_MIGRATION_READY;
before(()=> {process.env.KLAR_TENANT_AUTH_MIGRATION_READY='true';});
after(()=> { if(previousAuthFlag===undefined) delete process.env.KLAR_TENANT_AUTH_MIGRATION_READY; else process.env.KLAR_TENANT_AUTH_MIGRATION_READY=previousAuthFlag; });
function riskFixture(reports:number, blocks:number, ageDays:number) {
  const writes: Record<string,unknown>[]=[];
  const mockDb={
    doc: (path:string)=>{
      assert.match(path,/^tenants\/default\/(users|account_deletions)\//);
      return {path,get:async()=>({exists:!path.includes('/account_deletions/'),data:()=>path.includes('/account_deletions/')?undefined:{createdAt:new Date(Date.now()-ageDays*86400000)}}),set:async(value:Record<string,unknown>)=>{writes.push(value);}};
    },
    runTransaction: async <T>(fn:(tx:{get:(ref:{path:string})=>Promise<{exists:boolean;data:()=>Record<string,unknown>|undefined}>;set:(ref:{path:string},value:Record<string,unknown>)=>void})=>Promise<T>)=> fn({
      get:async ref=>({exists:!ref.path.includes('/account_deletions/'),data:()=>ref.path.includes('/account_deletions/')?undefined:{createdAt:new Date(Date.now()-ageDays*86400000)}}),
      set:(_ref,value)=>{writes.push(value);},
    }),
    collection: (path:string)=>{
      assert.ok(['tenants/default/reports','tenants/default/blocks'].includes(path));
      const count=path.endsWith('/reports')?reports:blocks;
      return {where:()=>({limit:()=>({get:async()=>({docs:Array.from({length:count},(_,i)=>({id:String(i),data:()=>({})}))})})})};
    },
  };
  return {db:mockDb as unknown as Firestore,writes};
}
test('evaluateAccountRisk escalates and writes flag for high-risk accounts',async()=>{
  const f=riskFixture(3,5,1);
  const decision=await evaluateAccountRisk(f.db,'bad-actor-1',{outboundMessages24h:120,externalPaymentMentions:2});
  assert.equal(decision.level,'high'); assert.equal(f.writes[0]?.requiresSafetyReview,true);
});
test('evaluateAccountRisk keeps benign accounts clean without update',async()=>{
  const f=riskFixture(0,0,365);
  assert.equal((await evaluateAccountRisk(f.db,'good-user-1',{})).level,'low'); assert.equal(f.writes.length,0);
});
test('evaluateAccountRisk escalates on multiple blocks and message velocity',async()=>{
  const f=riskFixture(3,5,2);
  assert.equal((await evaluateAccountRisk(f.db,'blocked-user-1',{repeatedMessageRatio:0.9,outboundMessages24h:110})).level,'high');
  assert.equal(f.writes[0]?.requiresSafetyReview,true);
});

test('privacySanitizer redacts Art. 9 health and medical data from prompts', () => {
  const input = "Ich suche jemanden mit Empathie. Ich hatte früher mit Depression zu kämpfen und mache Therapie.";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, false);
  assert.ok(res.redactedTypes.includes('art9_health'));
  assert.ok(!res.sanitized.toLowerCase().includes('depression'));
  assert.ok(!res.sanitized.toLowerCase().includes('therapie'));
  assert.ok(res.sanitized.includes('[REDACTED_ART9]'));
});

test('privacySanitizer redacts Art. 9 religious and political affiliation markers from prompts', () => {
  const input = "Glaube ist mir wichtig, ich bin gläubiger Moslem und engagiere mich bei den Grünen.";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, false);
  assert.ok(res.redactedTypes.includes('art9_religion_politics'));
  assert.ok(!res.sanitized.toLowerCase().includes('moslem'));
  assert.ok(!res.sanitized.toLowerCase().includes('grünen'));
  assert.ok(res.sanitized.includes('[REDACTED_ART9]'));
});

test('privacySanitizer redacts financial identifiers (IBAN) and off-platform contact details', () => {
  const input = "Schreib mir auf Telegram: @lisa_love oder WhatsApp +49 170 12345678, oder sende per PayPal: @lisa_pay meine IBAN ist DE89370400440532013000";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, false);
  assert.ok(res.redactedTypes.includes('contact_info'));
  assert.ok(res.redactedTypes.includes('financial'));
  assert.ok(!res.sanitized.includes('DE89370400440532013000'));
  assert.ok(!res.sanitized.includes('+49 170 12345678'));
  assert.ok(res.sanitized.includes('[REDACTED_FINANCIAL]'));
  assert.ok(res.sanitized.includes('[REDACTED_CONTACT]'));
});

test('privacySanitizer leaves clean dating intent prompts unchanged', () => {
  const input = "Hi, ich gehe gerne wandern, koche leidenschaftlich Pasta und suche eine langfristige Beziehung auf Augenhöhe.";
  const res = sanitizePromptInput(input);
  assert.equal(res.clean, true);
  assert.equal(res.redactedTypes.length, 0);
  assert.equal(res.sanitized, input);
});


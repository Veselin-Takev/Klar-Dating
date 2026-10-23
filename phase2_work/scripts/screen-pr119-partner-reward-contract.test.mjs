import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkRewardContract } from './screen-pr119-partner-reward-contract.mjs';

const serviceFile = process.env.KLAR_REWARD_SOURCE;
if (!serviceFile) throw new Error('Set KLAR_REWARD_SOURCE to independently Git-blob-verified PR119 service');
const source = readFileSync(serviceFile, 'utf8');
const doc = [
  '# Klar & Partner',
  "Status: NO-GO; Product/Security/DPO-Legal/Finance haben nicht zugestimmt.",
  "Aktueller Eintrag: rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only'",
  'Dies bedeutet keine unmittelbare Klar+-Gutschrift.',
].join('\n');
const good = checkRewardContract({ service: source, systemDoc: doc });

test('baseline: current source and aligned documentation pass static consistency but never GO', () => {
  assert.equal(good.static_contract_consistent,true, JSON.stringify(good.tests));
  assert.equal(good.production_release_decision,'NO-GO');
  assert.equal(good.source_checkout_authenticated_by_tool,false);
  assert.equal(good.purchase_verified_by_tool,false);
  assert.equal(good.financial_settlement_verified_by_tool,false);
});
function tamper(label,src,field,needle,replacement) {
  test('fail closed: '+label,()=>{
    assert(src.includes(needle),label+' fixture mismatch');
    const m={service:source,systemDoc:doc,[field]:src.replace(needle,replacement)};
    const result=checkRewardContract(m);
    assert.equal(result.static_contract_consistent,false,label);
    assert.equal(result.production_release_decision,'NO-GO');
  });
}
tamper('changed pending claim status',source,'service',"rewardStatus: 'pending_verification',\n      proofStatus: 'partner_assertion_only'","rewardStatus: 'earned',\n      proofStatus: 'partner_assertion_only'");
tamper('changed assertion proof status',source,'service',"proofStatus: 'partner_assertion_only'","proofStatus: 'verified_purchase'");
tamper('changed duplicate return',source,'service',"result.duplicate ? 'already_recorded' : 'pending_verification'","result.duplicate ? 'already_recorded' : 'earned'");
tamper('conversion function removed',source,'service','export async function recordPartnerConversion(','export async function deletedFunction(');
tamper('credit increment added',source,'service','    tx.create(audit.ref, withLedgerDetails(deps, audit,','    tx.update(campaignRef, { qualifiedConversions: FieldValue.increment(1) });\n    tx.create(audit.ref, withLedgerDetails(deps, audit,');
tamper('lost no-credit statement',source,'service','from this assertion alone.','from a different source.');
tamper('docs claim earned',doc,'systemDoc',"rewardStatus: 'pending_verification'","rewardStatus: 'earned'");
tamper('docs lose proof level',doc,'systemDoc',"proofStatus: 'partner_assertion_only'","proofStatus: 'verified_purchase'");
tamper('docs falsely claim earned reward',doc,'systemDoc','Dies bedeutet keine unmittelbare Klar+-Gutschrift.','Diese Conversion vergibt automatisch Klar+.');
tamper('docs omit signoffs',doc,'systemDoc','Product/Security/DPO-Legal/Finance','Product');
tamper('docs revive old earned claim',doc,'systemDoc','Dies bedeutet keine unmittelbare Klar+-Gutschrift.','Dies bedeutet keine unmittelbare Klar+-Gutschrift.\nEine Conversion mit Status `earned` bedeutet die Empfehlung ist qualifiziert.');
test('reject bad inputs rather than treating as clean',()=>{
  assert.throws(()=>checkRewardContract({service:null,systemDoc:doc}),TypeError);
  assert.throws(()=>checkRewardContract({service:source,systemDoc:undefined}),TypeError);
});
test('CLI refuses implicit paths',()=>{
  const script=fileURLToPath(new URL('./screen-pr119-partner-reward-contract.mjs', import.meta.url));
  const run=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:10000});
  assert.equal(run.status,2);
});

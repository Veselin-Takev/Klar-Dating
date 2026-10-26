import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectAdoptionEvidenceFailures as validate, safeEvidenceReference } from './adoption-evidence.mjs';
const now = Date.parse('2026-10-26T12:00:00Z');
const base = () => JSON.parse(readFileSync(new URL('../docs/phase3/EVIDENCE_REGISTER.json', import.meta.url), 'utf8'));
const check = data => validate(data, { now });
const reference = 'https://evidence.example.test/synthetic-test-only';
function approve(data, index, time) {
  Object.assign(data.gates[index], { status:'approved', named_approver: index === 3
    ? 'Synthetic-QA' : data.operating_model.technical_owner, approved_at:time,
    approval_commit:data.repository_base_sha, evidence_refs:[reference] });
  if(index===2) data.gates[index].independent_review={reviewer:'Synthetic-QA',approved_at:time,approval_commit:data.repository_base_sha,evidence_refs:[reference]};
}
function completedFixture() {
  // Structural fixture ONLY. No real person, completed pilot or approval is asserted.
  const data = base();
  data.operating_model.independent_qa_login = 'Synthetic-QA';
  data.assumptions_require_confirmation = false;
  data.documentation_status = 'business_reviewed';
  for (const [index,time] of ['2026-01-01T00:00:00Z','2026-01-02T00:00:00Z','2026-01-03T00:00:00Z',
    '2026-01-20T09:00:00Z','2026-01-20T10:00:00Z','2026-04-21T10:00:00Z'].entries()) approve(data,index,time);
  data.pilot_status='completed';data.pilot_start='2026-01-04T00:00:00Z';data.pilot_completed_at='2026-01-20T11:00:00Z';
  data.metrics.baseline={case_count:20,period_start:'2026-01-02T00:00:00Z',period_end:'2026-01-03T00:00:00Z',evidence_refs:[reference]};
  data.metrics.pilot={case_count:20,period_start:'2026-01-04T00:00:00Z',period_end:'2026-01-20T08:00:00Z',evidence_refs:[reference]};
  data.follow_up_reviews.forEach((review,index) => Object.assign(review,{status:'completed',
    date:['2026-02-19','2026-03-21','2026-04-20'][index],evidence_refs:[reference]}));
  data.requirements.forEach(row => Object.assign(row,{execution_status:'evidenced',evidence_refs:[reference]}));
  return data;
}
test('canonical register passes while reporting no pilot or production approval',()=> {
  const data=base();assert.deepEqual(check(data),[]);assert.equal(data.pilot_status,'not_started');
  assert.equal(data.production_approval,'not_confirmed');assert(data.gates.every(g=>g.status==='not_evidenced'));
});
test('complete synthetic lifecycle satisfies structural checks only',()=>assert.deepEqual(check(completedFixture()),[]));
test('a baseline can be recorded before pilot start after G0',()=> {
  const data=base(), full=completedFixture();data.assumptions_require_confirmation=false;data.documentation_status='business_reviewed';
  data.gates[0]=full.gates[0];data.metrics.baseline=full.metrics.baseline;
  assert.deepEqual(check(data),[]);
});
const mutations = [
  ['production approval',d=>d.production_approval='confirmed','PRODUCTION_APPROVAL'],
  ['missing gate',d=>d.gates.pop(),'GATE_SET'],
  ['duplicate gate',d=>d.gates[1].id='G0','GATE_SET'],
  ['gate reordered',d=>d.gates.reverse(),'GATE_SET'],
  ['future register date',d=>d.as_of='2099-01-01','REGISTER_DATE'],
  ['impossible register date',d=>d.as_of='2026-02-30','REGISTER_DATE'],
  ['invalid commit',d=>d.repository_base_sha='main','BASE_COMMIT'],
  ['fake pilot completion',d=>d.pilot_status='completed','PILOT_COMPLETION'],
  ['unstarted metrics',d=>d.metrics.pilot={case_count:20},'UNSTARTED_PILOT_METRICS'],
  ['missing metrics container',d=>delete d.metrics,'METRICS_OBJECT'],
  ['fake requirement execution',d=>d.requirements[0].execution_status='evidenced','REQUIREMENT_EXECUTION'],
  ['missing requirement',d=>d.requirements.pop(),'REQUIREMENT_SET'],
  ['duplicate requirement',d=>d.requirements[1].id=d.requirements[0].id,'REQUIREMENT_SET'],
  ['prototype artifact name',d=>d.requirements[0].id='toString','REQUIREMENT_ARTIFACT'],
  ['path traversal artifact',d=>d.requirements[0].artifact='../PRIVATE.md','REQUIREMENT_ARTIFACT'],
  ['unassigned owner',d=>d.operating_model.technical_owner=null,'SOLO_TECHNICAL_OWNER'],
  ['self assigned as independent QA',d=>d.operating_model.independent_qa_login=d.operating_model.technical_owner,'INDEPENDENT_QA_ASSIGNMENT'],
  ['unknown gate state',d=>d.gates[0].status='PASS','GATE_STATUS'],
  ['unevidenced gate with signature',d=>d.gates[0].named_approver='Synthetic-QA','UNEVIDENCED_GATE'],
  ['unscheduled review with date',d=>d.follow_up_reviews[0].date='2026-01-01','UNSCHEDULED_REVIEW'],
];
for (const [name,mutate,expected] of mutations) test('rejects '+name,()=> {
  const data=base();mutate(data);assert(check(data).some(code=>code.includes(expected)));
});
const approvalMutations = [
  ['pilot starts before G2 approval',d=>d.pilot_start='2026-01-02T12:00:00Z','PILOT_START_GATE'],
  ['pilot completes before G4 approval',d=>d.pilot_completed_at='2026-01-20T09:30:00Z','PILOT_COMPLETION'],
  ['future approval',d=>d.gates[0].approved_at='2099-01-01T00:00:00Z','APPROVAL_EVIDENCE'],
  ['missing approval link',d=>d.gates[0].evidence_refs=[],'APPROVAL_EVIDENCE'],
  ['wrong approval commit',d=>d.gates[0].approval_commit='f'.repeat(40),'APPROVAL_EVIDENCE'],
  ['unconfirmed assumptions',d=>d.assumptions_require_confirmation=true,'G0_UNCONFIRMED'],
  ['out of order approval',d=>d.gates[1].approved_at='2025-12-30T00:00:00Z','GATE_TIME_ORDER'],
  ['missing prerequisite',d=>d.gates[1].status='not_evidenced','GATE_PREREQUISITE'],
  ['self QA approval',d=>d.gates[2].independent_review.reviewer=d.operating_model.technical_owner,'INDEPENDENT_QA_REVIEW'],
  ['no QA assigned',d=>d.operating_model.independent_qa_login=null,'INDEPENDENT_QA_APPROVAL'],
  ['object approver',d=>d.gates[2].named_approver={name:'Synthetic'},'APPROVAL_EVIDENCE'],
  ['false sustainable adoption',d=>Object.assign(d.follow_up_reviews[2],{status:'scheduled',evidence_refs:[]}),'SUSTAINED_ADOPTION'],
  ['early followup',d=>d.follow_up_reviews[2].date='2026-02-01','FOLLOWUP_DATE'],
  ['future completed followup',d=>d.follow_up_reviews[2].date='2099-02-01','FOLLOWUP_EVIDENCE'],
  ['review before pilot completion',d=>d.pilot_completed_at=null,'FOLLOWUP_DATE'],
  ['insufficient pilot cases',d=>d.metrics.pilot.case_count=19,'PILOT_MINIMUM'],
  ['negative case count',d=>d.metrics.pilot.case_count=-1,'METRIC_EVIDENCE'],
  ['baseline after start',d=>d.metrics.baseline.period_end='2026-01-05T00:00:00Z','PILOT_MEASUREMENT_ORDER'],
  ['pilot before start',d=>d.metrics.pilot.period_start='2026-01-01T00:00:00Z','PILOT_MEASUREMENT_ORDER'],
  ['future completion',d=>d.pilot_completed_at='2099-01-01T00:00:00Z','PILOT_COMPLETION'],
];
for (const [name,mutate,expected] of approvalMutations) test('rejects '+name,()=> {
  const data=completedFixture();mutate(data);assert(check(data).some(code=>code.includes(expected)));
});
test('malformed data fails without crashing',()=> {
  for(const data of [null,[],{},true,{gates:[null],requirements:[null],follow_up_reviews:[null]}])
    assert(validate(data,{now}).length>0);
  assert.deepEqual(validate(base(),{now:NaN}),['INVALID_CLOCK']);
});
test('evidence links cannot carry credentials, query tokens or non-HTTPS schemes',()=> {
  for(const value of ['http://example.test/a','https://user:secret@example.test/a','https://example.test/a?token=secret',
    'file:///private','javascript:alert(1)','https://example.test/with space',null]) assert.equal(safeEvidenceReference(value),false);
  assert.equal(safeEvidenceReference(reference),true);
});

test('unexpected assertion and personal-data fields are rejected',()=> {
  for(const mutate of [data=>data.productionApproved=true, data=>data.metrics.pilot={user_emails:['private@example.test']},
    data=>data.gates[0].approved=true, data=>data.requirements[0].participant_names=['Private'],
    data=>data.follow_up_reviews[0].raw_prompt='private']) {
    const data=base();mutate(data);assert(check(data).some(code=>code.startsWith('UNKNOWN_')));
  }
});
test('approval cannot postdate the register snapshot',()=> {
  const data=completedFixture();data.as_of='2026-02-01';assert(check(data).includes('APPROVAL_AFTER_REGISTER_DATE_5'));
});

test('G2 keeps owner accountability and requires a separate independent QA receipt',()=> {
  const data=completedFixture();assert.equal(data.gates[2].named_approver,data.operating_model.technical_owner);
  for(const mutate of [d=>d.gates[2].independent_review=null,
    d=>d.gates[2].independent_review.approval_commit='b'.repeat(40),
    d=>d.gates[2].independent_review.approved_at='2099-01-01T00:00:00Z']) {
    const changed=structuredClone(data);mutate(changed);assert(check(changed).includes('INDEPENDENT_QA_REVIEW_2'));
  }
});
test('completed gates cannot coexist with unreported requirement execution',()=> {
  const data=completedFixture();data.requirements[0].execution_status='not_evidenced';data.requirements[0].evidence_refs=[];
  assert(check(data).includes('SUSTAINED_REQUIREMENT_EVIDENCE'));
});
test('CI register gate remains unconditional and the local command runs both checks',()=> {
  const workflow=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');
  const start=workflow.indexOf('      - name: Adoption evidence consistency');
  assert(start>=0);const step=workflow.slice(start,workflow.indexOf('      - ',start+10));
  assert(step.includes('node --test scripts/test-adoption-evidence.mjs'));
  assert(step.includes('node scripts/check-adoption-evidence.mjs'));assert(!/\bif:/.test(step));
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.scripts['check:adoption-evidence'],'node --test scripts/test-adoption-evidence.mjs && node scripts/check-adoption-evidence.mjs');
});

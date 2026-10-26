import { technicalOwner } from './codeowners-review-policy.mjs';

const requirements = {
  ADKAR: ['ADOPTION_PLAYBOOK.md', 'G5'],
  PERSONA_WORKFLOW: ['ADOPTION_PLAYBOOK.md', 'G4'],
  FOUR_WEEK_ENABLEMENT: ['ENABLEMENT_AND_TEMPLATES.md', 'G4'],
  PROMPT_FEEDBACK: ['ENABLEMENT_AND_TEMPLATES.md', 'G3'],
  COMMUNICATION_WORKSHOPS: ['ENABLEMENT_AND_TEMPLATES.md', 'G4'],
  ADOPTION_SCORECARD: ['SCORECARD_AND_ACCEPTANCE.md', 'G3'],
};
const roles = ['Business Owner', 'Change Lead', 'Workflow Owner', 'QA', 'Business Owner', 'Change Lead'];
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const lower = value => typeof value === 'string' ? value.toLowerCase() : '';
const login = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(value);
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'));
export function safeEvidenceReference(value) {
  if (typeof value !== 'string' || value.length > 1024 || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.search;
  } catch { return false; }
}
const refs = value => Array.isArray(value) && value.length > 0 && value.every(safeEvidenceReference)
  && new Set(value).size === value.length;
const exactKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => allowed.includes(key));
const emptyRefs = value => Array.isArray(value) && value.length === 0;

/** Validates claim consistency only. Does not authenticate approvers, fetch URLs,
 * verify signatures, establish legal compliance, or authorize production.
 */
export function collectAdoptionEvidenceFailures(data, { now = Date.now() } = {}) {
  if (!Number.isFinite(now)) return ['INVALID_CLOCK'];
  const failures = [];
  const check = (condition, code) => { if (!condition) failures.push(code); };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['REGISTER_OBJECT_REQUIRED'];
  check(exactKeys(data, ['schema_version','document_version','as_of','repository_base_sha','documentation_status','pilot_status','production_approval','assumptions_require_confirmation','pilot_start','pilot_completed_at','pause_evidence_ref','metrics','gates','requirements','follow_up_reviews','execution_note','operating_model']), 'UNKNOWN_REGISTER_FIELD');
  check(data.schema_version === 1, 'REGISTER_SCHEMA_VERSION');
  check(typeof data.document_version === 'string' && /^\d+\.\d+$/.test(data.document_version), 'DOCUMENT_VERSION');
  check(day(data.as_of) && data.as_of <= new Date(now).toISOString().slice(0,10), 'REGISTER_DATE');
  check(sha(data.repository_base_sha), 'BASE_COMMIT');
  check(['prepared_pending_business_review', 'business_reviewed'].includes(data.documentation_status), 'DOCUMENTATION_STATUS');
  // This register is not an alternative authority to the protected release gate.
  check(data.production_approval === 'not_confirmed', 'PRODUCTION_APPROVAL_MUST_USE_RELEASE_GATE');
  check(typeof data.assumptions_require_confirmation === 'boolean', 'ASSUMPTIONS_STATUS');
  const model = data.operating_model;
  check(exactKeys(model, ['mode','technical_owner','independent_qa_login']), 'UNKNOWN_OPERATING_MODEL_FIELD');
  check(model?.mode === 'solo' && model?.technical_owner === technicalOwner.slice(1), 'SOLO_TECHNICAL_OWNER');
  const qa = model?.independent_qa_login;
  check(qa === null || (login(qa) && qa.toLowerCase() !== technicalOwner.slice(1).toLowerCase()), 'INDEPENDENT_QA_ASSIGNMENT');
  const gates = Array.isArray(data.gates) ? data.gates : [];
  check(gates.length === 6 && gates.every((gate, index) => gate?.id === 'G'+index), 'GATE_SET_AND_ORDER');
  const approved = id => gates.find(gate => gate?.id === id)?.status === 'approved';
  for (const [index, gate] of gates.entries()) {
    if (!gate || typeof gate !== 'object') { failures.push('GATE_OBJECT'); continue; }
    check(exactKeys(gate, ['id','status','accountable_role','named_approver','approved_at','approval_commit','evidence_refs','independent_review']), 'UNKNOWN_GATE_FIELD');
    check(gate.accountable_role === roles[index], 'GATE_ACCOUNTABILITY_'+index);
    check(['not_evidenced', 'approved'].includes(gate.status), 'GATE_STATUS_'+index);
    if (gate.status !== 'approved') {
      check(gate.named_approver === null && gate.approved_at === null && gate.approval_commit === null
        && emptyRefs(gate.evidence_refs) && gate.independent_review === null, 'UNEVIDENCED_GATE_HAS_CLAIMS_'+index);
      continue;
    }
    check(Date.parse(gate.approved_at) < Date.parse(data.as_of)+86_400_000, 'APPROVAL_AFTER_REGISTER_DATE_'+index);
    check(login(gate.named_approver) && instant(gate.approved_at) && Date.parse(gate.approved_at) <= now
      && gate.approval_commit === data.repository_base_sha && sha(gate.approval_commit)
      && refs(gate.evidence_refs), 'APPROVAL_EVIDENCE_'+index);
    if (index > 0) {
      check(approved('G'+(index-1)), 'GATE_PREREQUISITE_'+index);
      check(Date.parse(gates[index-1]?.approved_at) <= Date.parse(gate.approved_at), 'GATE_TIME_ORDER_'+index);
    }
    if (index === 3) {
      check(login(qa) && lower(qa) === lower(gate.named_approver)
        && lower(gate.named_approver) !== lower(technicalOwner.slice(1)), 'INDEPENDENT_QA_APPROVAL_'+index);
    } else check(lower(gate.named_approver) === lower(technicalOwner.slice(1)), 'SOLO_OWNER_APPROVAL_'+index);
    if (index === 2) {
      const review = gate.independent_review;
      check(exactKeys(review, ['reviewer','approved_at','approval_commit','evidence_refs'])
        && login(qa) && lower(review?.reviewer) === lower(qa)
        && lower(review?.reviewer) !== lower(technicalOwner.slice(1))
        && instant(review?.approved_at) && Date.parse(review.approved_at) <= Date.parse(gate.approved_at)
        && review.approval_commit === data.repository_base_sha && refs(review.evidence_refs), 'INDEPENDENT_QA_REVIEW_2');
    } else check(gate.independent_review === null, 'UNEXPECTED_INDEPENDENT_REVIEW_'+index);
  }
  check(['not_started','in_progress','paused','completed'].includes(data.pilot_status), 'PILOT_STATUS');
  if (data.pilot_status === 'not_started') {
    check(data.pilot_start === null && data.pilot_completed_at === null, 'UNSTARTED_PILOT_DATES');
    check(data.metrics?.pilot === null, 'UNSTARTED_PILOT_METRICS');
    check(!approved('G3') && !approved('G4') && !approved('G5'), 'UNSTARTED_PILOT_APPROVAL');
  } else {
    check(instant(data.pilot_start) && Date.parse(data.pilot_start) <= now && approved('G2'), 'PILOT_START_GATE');
    if (data.pilot_status === 'paused') check(safeEvidenceReference(data.pause_evidence_ref), 'PAUSE_EVIDENCE');
    if (data.pilot_status === 'completed') {
      check(instant(data.pilot_completed_at) && Date.parse(data.pilot_completed_at) >= Date.parse(data.pilot_start)
        && Date.parse(data.pilot_completed_at) <= now && approved('G4'), 'PILOT_COMPLETION');
    } else check(data.pilot_completed_at === null, 'INCOMPLETE_PILOT_HAS_COMPLETION_DATE');
  }
  check(exactKeys(data.metrics, ['baseline','pilot']), 'METRICS_OBJECT');
  for (const name of ['baseline','pilot']) {
    const metric = data.metrics?.[name];
    if (metric === null) continue;
    check(exactKeys(metric, ['case_count','period_start','period_end','evidence_refs']), 'UNKNOWN_METRIC_FIELD');
    check(metric && typeof metric === 'object' && Number.isSafeInteger(metric.case_count) && metric.case_count >= 0
      && instant(metric.period_start) && instant(metric.period_end)
      && Date.parse(metric.period_end) >= Date.parse(metric.period_start) && Date.parse(metric.period_end) <= now
      && Date.parse(metric.period_end) < Date.parse(data.as_of)+86_400_000
      && refs(metric.evidence_refs), 'METRIC_EVIDENCE_'+name);
  }
  if (data.metrics?.baseline !== null) check(approved('G0'), 'BASELINE_WITHOUT_G0');
  if (approved('G3')) {
    check(data.metrics?.baseline?.case_count >= 20 && data.metrics?.pilot?.case_count >= 20, 'PILOT_MINIMUM_EVIDENCE');
    check(Date.parse(data.metrics?.baseline?.period_end) <= Date.parse(data.pilot_start)
      && Date.parse(data.metrics?.pilot?.period_start) >= Date.parse(data.pilot_start)
      && Date.parse(data.metrics?.pilot?.period_end) <= Date.parse(gates[3]?.approved_at), 'PILOT_MEASUREMENT_ORDER');
  }
  if (data.documentation_status === 'business_reviewed') check(approved('G0'), 'BUSINESS_REVIEW_WITHOUT_G0');
  if (approved('G0')) {
    check(data.assumptions_require_confirmation === false, 'G0_UNCONFIRMED_ASSUMPTIONS');
    check(data.documentation_status === 'business_reviewed', 'G0_WITHOUT_BUSINESS_REVIEW');
  }
  const rows = Array.isArray(data.requirements) ? data.requirements : [];
  check(rows.length === 6 && new Set(rows.map(row => row?.id)).size === 6, 'REQUIREMENT_SET');
  for (const row of rows) {
    check(exactKeys(row, ['id','artifact','delivery_status','execution_status','evidence_refs']), 'UNKNOWN_REQUIREMENT_FIELD');
    const requirement = Object.hasOwn(requirements, row?.id) ? requirements[row.id] : undefined;
    check(requirement && row.artifact === requirement[0] && row.delivery_status === 'documented', 'REQUIREMENT_ARTIFACT');
    check(['not_evidenced','evidenced'].includes(row?.execution_status), 'REQUIREMENT_STATUS');
    check(row?.execution_status === 'evidenced' ? requirement && approved(requirement[1]) && refs(row.evidence_refs)
      : emptyRefs(row?.evidence_refs), 'REQUIREMENT_EXECUTION_EVIDENCE');
  }
  const reviews = Array.isArray(data.follow_up_reviews) ? data.follow_up_reviews : [];
  check(reviews.length === 3 && reviews.every((review,index) => review?.offset_days === [30,60,90][index]), 'FOLLOWUP_SET');
  for (const review of reviews) {
    check(exactKeys(review, ['offset_days','date','owner_role','status','evidence_refs']), 'UNKNOWN_FOLLOWUP_FIELD');
    check(review?.owner_role === 'Change Lead', 'FOLLOWUP_OWNER');
    check(review && ['not_scheduled','scheduled','completed'].includes(review.status), 'FOLLOWUP_STATUS');
    if (!review || review.status === 'not_scheduled') {
      check(review?.date === null && emptyRefs(review?.evidence_refs), 'UNSCHEDULED_REVIEW_HAS_CLAIMS'); continue;
    }
    check(day(review.date) && instant(data.pilot_completed_at)
      && Date.parse(review.date)+86_400_000 > Date.parse(data.pilot_completed_at)+review.offset_days*86_400_000, 'FOLLOWUP_DATE');
    if (review.status === 'completed') check(refs(review.evidence_refs)
      && review.date <= data.as_of && Date.parse(review.date) <= now && data.pilot_status === 'completed', 'FOLLOWUP_EVIDENCE');
    else check(emptyRefs(review.evidence_refs), 'SCHEDULED_REVIEW_HAS_COMPLETION_EVIDENCE');
  }
  if (approved('G5')) check(data.pilot_status === 'completed' && reviews.length === 3
    && reviews.every(review => review?.status === 'completed' && Date.parse(review.date) <= Date.parse(gates[5]?.approved_at)), 'SUSTAINED_ADOPTION_EVIDENCE');
  if (approved('G5')) check(rows.every(row => row?.execution_status === 'evidenced'), 'SUSTAINED_REQUIREMENT_EVIDENCE');
  return [...new Set(failures)];
}

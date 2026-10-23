import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Audit only. This static checker cannot authenticate a checkout, purchase, external
// account, finance settlement, Firestore transaction or human approval.
export const TARGET_SHA = '7fdf29010c85f16a9b38e5c93186f32e92192f3a';
const FUNCTION_START = 'export async function recordPartnerConversion(';

export function checkRewardContract({ service, systemDoc }) {
  if (typeof service !== 'string' || typeof systemDoc !== 'string') throw new TypeError('Both sources must be text');
  const start = service.indexOf(FUNCTION_START);
  const body = start < 0 ? '' : service.slice(start);
  const eventStart = body.indexOf('tx.create(eventRef, {');
  const claimStart = body.indexOf('tx.create(buyerClaimRef, {', eventStart + 1);
  const eventRecord = eventStart < 0 || claimStart < 0 ? '' : body.slice(eventStart, claimStart);
  const tests = {
    conversion_handler_present: start >= 0,
    partner_assertion_proof_only: eventRecord.includes("proofStatus: 'partner_assertion_only'"),
    claim_record_pending: eventRecord.includes("rewardStatus: 'pending_verification'"),
    assertion_response_pending: body.includes("result.duplicate ? 'already_recorded' : 'pending_verification'"),
    no_qualified_counter_increment_in_conversion: !/qualifiedConversions\s*:\s*FieldValue\.increment\s*\(/.test(body),
    no_direct_earned_status_in_conversion: !/rewardStatus\s*:\s*['\"]earned['\"]/.test(body),
    no_partner_credit_from_assertion: body.includes('Never credit') && body.includes('from this assertion alone.'),
    docs_current_status: systemDoc.includes("rewardStatus: 'pending_verification'") && systemDoc.includes("proofStatus: 'partner_assertion_only'"),
    docs_no_unverified_credit: systemDoc.includes('keine unmittelbare Klar+-Gutschrift'),
    docs_pending_authorizations: systemDoc.includes('Product/Security/DPO-Legal/Finance') && systemDoc.includes('NO-GO'),
    docs_legacy_earned_description_removed: !systemDoc.includes('Eine Conversion mit Status `earned` bedeutet'),
  };
  return {
    immutable_target_sha: TARGET_SHA,
    audit_only: true,
    source_checkout_authenticated_by_tool: false,
    purchase_verified_by_tool: false,
    financial_settlement_verified_by_tool: false,
    tests,
    static_contract_consistent: Object.values(tests).every(Boolean),
    production_release_decision: 'NO-GO',
  };
}

function parseArgs(argv) {
  const allowed = new Set(['--service','--doc']);
  let args = {};
  for (let i=0;i<argv.length;i+=2) {
    if (!allowed.has(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--') || args[argv[i]]) {
      throw new Error('Explicit --service <verified-source-file> --doc <audited-document-file> required');
    }
    args[argv[i]] = argv[i+1];
  }
  if (Object.keys(args).length !== 2 || !args['--service'] || !args['--doc']) {
    throw new Error('Explicit --service and --doc required');
  }
  return args;
}

function run(argv) {
  const args = parseArgs(argv);
  const service = readFileSync(realpathSync(resolve(args['--service'])), 'utf8');
  const systemDoc = readFileSync(realpathSync(resolve(args['--doc'])), 'utf8');
  const result = checkRewardContract({ service, systemDoc });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.static_contract_consistent) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv.slice(2)); }
  catch (err) { process.stderr.write('Reward audit input error: '+ (err instanceof Error ? err.message : String(err)) +'\n'); process.exitCode = 2; }
}

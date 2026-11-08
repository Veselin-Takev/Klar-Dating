/** Output is constructed from fixed labels and numeric counters. Arbitrary
 * errors/strings/objects (including getters, causes and stacks) are discarded,
 * rather than attempting an incomplete regex blacklist of personal data. */
const events = new Set([
  'http_request','http_request_aborted','server_started','server_shutdown',
  'server_shutdown_timeout','server_shutdown_failed','rate_limit_unavailable',
  'analytics_event_recorded','analytics_tracking_unavailable',
  'verification_photo_p0_fencing_unverified','message_archival',
  'translation_fallback','firestore_health_failure','auth_health_failure',
  'adult_consent_check_failure','audit_log_write_failure','smart_audit_image_failure',
  'smart_audit_failure','dating_readiness_failure','daily_coach_failure',
  'server_start_failure','feedback_storage_failure','device_token_storage_failure',
  'audit_log_read_failure','account_deletion_limit_failure','account_logout_failure',
  'account_status_read_failure','date_availability_create_failure',
  'date_availability_delete_failure','date_availability_read_failure',
  'date_connections_failure','date_ideas_failure','date_plan_create_failure',
  'date_plan_delete_failure','date_plans_read_failure','billing_checkout_failure',
  'compliance_audit_query_failure','compliance_audit_read_failure','compliance_audit_export_failure',
  'unclassified_failure','operational_event',
]);
const numberKeys = ['status','durationMs','port','archived','scannedChats','removedFunnelEvents'];
export function safeLogRecord(level: string, args: readonly unknown[]): Record<string, string | number> {
  const result: Record<string,string|number> = { level: level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO', event: 'operational_event' };
  try {
    const first = args[0];
    if (typeof first === 'string' && events.has(first)) { result.event = first; return result; }
    if (typeof first !== 'string' || first.length > 4096 || first[0] !== '{') return result;
    // Only JSON text is inspected, never a thrown object's properties/getters.
    const parsed: unknown = JSON.parse(first);
    if (!parsed || typeof parsed !== 'object' || !('event' in parsed) || typeof parsed.event !== 'string' || !events.has(parsed.event)) return result;
    const data = parsed as Record<string,unknown>;
    result.event = parsed.event;
    for (const key of numberKeys) if (typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0) result[key] = data[key];
    if (typeof data.method === 'string' && ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(data.method)) result.method = data.method;
    return result;
  } catch { return result; }
}

let installed = false;
export function installPrivacyLogging(): void {
  if (installed) return;
  installed = true;
  const sinks = { info: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };
  for (const level of ['log','info','warn','error','debug','trace','dir','table','assert'] as const) {
    const severity = level === 'error' || level === 'trace' || level === 'assert' ? 'error' : level === 'warn' ? 'warn' : 'info';
    console[level] = (...args: unknown[]) => {
      if (level === 'assert' && args[0]) return;
      // Use plain sinks: native trace/dir/table can append a second, unfiltered
      // stack or representation. Preserve assert's boolean control semantics.
      sinks[severity](JSON.stringify(safeLogRecord(severity, level === 'assert' ? args.slice(1) : args)));
    };
  }
}

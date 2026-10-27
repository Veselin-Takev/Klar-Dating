/** Fixed operational failure events. Never accept error objects or request data. */
const failureEvents = {
  translation_fallback: 'warn',
  firestore_health_failure: 'warn',
  auth_health_failure: 'warn',
  adult_consent_check_failure: 'error',
  audit_log_write_failure: 'error',
  smart_audit_image_failure: 'error',
  smart_audit_failure: 'error',
  dating_readiness_failure: 'error',
  daily_coach_failure: 'error',
  server_start_failure: 'error',
  feedback_storage_failure: 'warn',
  device_token_storage_failure: 'error',
  audit_log_read_failure: 'error',
  account_deletion_limit_failure: 'error',
  account_logout_failure: 'error',
  account_status_read_failure: 'error',
  billing_checkout_failure: 'error',
  compliance_audit_query_failure: 'error',
  compliance_audit_read_failure: 'error',
  compliance_audit_export_failure: 'error',
  unclassified_failure: 'error',
} as const;
export type SafeFailureEvent = keyof typeof failureEvents;

export function logSafeFailure(event: SafeFailureEvent): void {
  // Enforce the allowlist at runtime as well: JS callers must not inject labels.
  const safeEvent = typeof event === 'string' && Object.hasOwn(failureEvents, event)
    ? event : 'unclassified_failure';
  const level = failureEvents[safeEvent];
  console[level](JSON.stringify({ level: level === 'warn' ? 'WARN' : 'ERROR', event: safeEvent }));
}

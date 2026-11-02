import { z } from 'zod';
import { tenantIdSchema, assertIssuedTenantContext, type TenantContext } from './tenantAuth';
import type { TenantReadRepository } from './tenantData';

const flagSchema = z.object({
  tenantId: tenantIdSchema,
  enabled: z.boolean(),
  status: z.literal('active'),
});
const flagIdSchema = z.string().min(1).max(64).regex(/^[A-Z][A-Z0-9_]+$/);
/** Structural Pino logger contract; caller must provide a real configured
 * Pino instance. No stdout fallback can silently drop tenant audit events.
 */
export interface PinoTenantAuditSink {
  info(fields: {
    tenant_id: string; trace_id: string; timestamp: string;
    flag_name: string; enabled: boolean; outcome: 'allowed' | 'denied';
  }, message: string): void;
}
export async function evaluateTenantFlag(
  context: TenantContext,
  flagName: string,
  repo: TenantReadRepository,
  logger: PinoTenantAuditSink,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  const identity = assertIssuedTenantContext(context);
  const flag = flagIdSchema.parse(flagName);
  let enabled = false;
  try {
    const parsed = flagSchema.safeParse(await repo.getFeatureFlag(flag));
    if (parsed.success && parsed.data.tenantId === identity.tenantId) {
      enabled = parsed.data.enabled;
    }
  } finally {
    // Even malformed/missing cross-tenant data or Firestore outages must
    // produce an audit event. A logging error fails the request closed.
    logger.info({
      tenant_id: identity.tenantId,
      trace_id: identity.traceId,
      timestamp: now().toISOString(),
      flag_name: flag, enabled,
      outcome: enabled ? 'allowed' : 'denied',
    }, 'tenant_feature_flag_evaluated');
  }
  return enabled;
}

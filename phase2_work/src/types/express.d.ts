import type { TenantRequestContext } from '../server/tenantRequestContext';
import type { DecodedIdToken } from 'firebase-admin/auth';

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
      readonly tenantContext?: TenantRequestContext;
      session?: unknown;
      nutzer?: Record<string, unknown>;
      istGast?: boolean;
    }
  }
}

export {};

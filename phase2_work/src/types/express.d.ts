import type { DecodedIdToken } from 'firebase-admin/auth';

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
      session?: unknown;
      nutzer?: Record<string, unknown>;
      istGast?: boolean;
    }
  }
}

export {};

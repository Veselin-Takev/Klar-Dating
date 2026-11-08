import type { Firestore } from 'firebase-admin/firestore';
import { TenantAwareFirestoreRepository as ScopedRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { resolveVerifiedTenantContext } from './tenantRequestContext';
/** API adapter: tenant authority is the revocation-verified token, never request input. */
export class TenantAwareFirestoreRepository extends ScopedRepository {
  constructor(
    db: Firestore,
    decodedToken: unknown,
    observe?: <T>(work: () => Promise<T>) => Promise<T>,
  ) {
    super(db, resolveVerifiedTenantContext(decodedToken).tenant, observe);
  }
}

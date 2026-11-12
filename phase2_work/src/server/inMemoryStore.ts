import { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import {
  LocalRepositoryStore,
  assertLocalRepositoryMode,
} from './firestoreRepository/localStore';

/** Explicit local-only store: empty by default, no fabricated account or consent state. */
export class InMemoryTenantStore {
  readonly #store: LocalRepositoryStore;
  constructor() {
    assertLocalRepositoryMode();
    this.#store = new LocalRepositoryStore();
  }
  repository(tenantId: string): TenantAwareFirestoreRepository {
    assertLocalRepositoryMode();
    return new TenantAwareFirestoreRepository(this.#store, tenantId);
  }
}

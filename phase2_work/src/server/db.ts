/** Legacy compatibility facade; callers must migrate to TenantAwareFirestoreRepository. */
export { FieldValue, getServerFirebaseApp, getDb, initServerDb, runObservedTransaction } from './firestoreRepository/nativeDatabase';

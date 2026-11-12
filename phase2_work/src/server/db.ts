/** Compatibility for emulator fixtures. Production callers use closed repository factories. */
export {
  FieldValue,
  getServerFirebaseApp,
  initServerDb,
  closeServerDb,
  getEmulatorDatabase as getDb,
} from './firestoreRepository/nativeDatabase';

/**
 * Child process for a destructive emulator-only SIGKILL recovery test.
 * NEVER import or run this fixture from an app route or production worker.
 */
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const projectIds = [
  process.env.GCLOUD_PROJECT,
  process.env.GOOGLE_CLOUD_PROJECT,
  process.env.FIREBASE_PROJECT_ID,
].filter(Boolean);
const uid = process.argv[2];
const requestId = process.argv[3];

if (
  process.platform !== 'linux'
  || process.env.NODE_ENV === 'production'
  || !/^(localhost|127[.]0[.]0[.]1|\[::1\]):[0-9]{1,5}$/.test(host)
  || !process.env.FIREBASE_STORAGE_EMULATOR_HOST
  || projectIds.length < 1
  || !projectIds.every(id => id === 'demo-klar')
  || !uid?.startsWith('registry-real-crash-')
  || !/^[0-9a-f-]{36}$/.test(requestId ?? '')
) {
  process.exitCode = 65;
} else {
  // Dynamic imports only AFTER the strict local-emulator guard above.
  const { getDb } = await import('../../src/server/db');
  const { runAccountDeletion } = await import('../../src/server/accountDeletion');
  const { purgeAccountData } = await import('../../src/server/trustAndSafety');

  await runAccountDeletion(uid, {
    db: getDb(),
    now: Date.now,
    disable: async () => {},
    removeAuth: async () => {},
    cancelSubscription: async () => {},
    eraseProvider: async () => true,
    purge: (ownerUid, id, lease) => purgeAccountData(ownerUid, id, lease, {
      // Fires synchronously only AFTER an acknowledged destructive batch.
      // Kill exactly this isolated Node process, leaving Firestore persisted.
      onProgress: () => { process.kill(process.pid, 'SIGKILL'); },
    }),
  });
  // Reaching here means the SIGKILL seam never fired: fail the parent test.
  process.exitCode = 66;
}

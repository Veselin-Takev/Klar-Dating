#!/usr/bin/env node
/**
 * Read-only verification retention inventory for LOCAL FIRESTORE EMULATOR ONLY.
 * No production/staging connectivity, no credentials, no writes, no user IDs in
 * output. Production SRE inventory requires a separate reviewed read-only tool.
 */
const args = new Set(process.argv.slice(2));
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';

if (!args.has('--emulator-only') || !/^demo-[a-z0-9-]+$/.test(projectId) ||
    !/^(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}$/.test(emulatorHost)) {
  process.stderr.write('Refused: --emulator-only, demo-* project and loopback FIRESTORE_EMULATOR_HOST required.\n');
  process.exit(2);
}
if ([...args].some(arg => arg !== '--emulator-only')) {
  process.stderr.write('Refused: unsupported invocation argument.\n');
  process.exit(2);
}

try {
  const [{ initializeApp }, { getFirestore, FieldPath }, { censusVerificationRetentionBacklog }] =
    await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/firestore'),
      import('../src/server/platform/verificationBacklogCensus.ts'),
    ]);
  initializeApp({ projectId });
  const db = getFirestore();
  const source = db.collection('verification_events').orderBy(FieldPath.documentId());
  const pageReader = async (cursor, limit) => {
    const snapshot = await (cursor ? source.startAfter(cursor) : source).limit(limit).get();
    return {
      rows: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })),
      lastCursor: snapshot.docs.at(-1),
    };
  };
  const summary = await censusVerificationRetentionBacklog(pageReader, {
    now: Date.now(), pageSize: 100, maxPages: 20,
  });
  process.stdout.write(JSON.stringify({
    scope: 'local-firestore-emulator-only',
    releaseApproval: false,
    collection: 'verification_events',
    ...summary,
  }, null, 2) + '\n');
  if (!summary.complete) process.exitCode = 3;
} catch {
  process.stderr.write('Read-only emulator inventory failed; no records or identifiers emitted.\n');
  process.exitCode = 1;
}

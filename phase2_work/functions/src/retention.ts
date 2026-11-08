// Minimal structural port keeps the app and Functions SDK installations independent.
type Metadata = { generation?: unknown; temporaryHold?: unknown; eventBasedHold?: unknown };
type Photo = { getMetadata(): Promise<[Metadata, ...unknown[]]>; delete(options: { ifGenerationMatch: string | number }): Promise<unknown> };
type Bucket = {
  getFiles(options: { prefix: string; maxResults: number; autoPaginate: false; pageToken?: string }): Promise<[Photo[], { pageToken?: string } | null | undefined, ...unknown[]]>;
};

/** One bounded page per prefix; false means acknowledged progress, not completion.
 * Re-list from the beginning because deleted objects disappear. Never skip a hold
 * or generation conflict and then declare the account's storage empty.
 *
 * VES-5: verification photos are owned by a cross-service decision/hold
 * protocol that is NOT yet safely fenced. Real account deletion may erase
 * ordinary profile photos, but MUST NOT delete verification objects or claim
 * account erasure complete while verification objects exist.
 *
 * The explicit legacy mode is reserved for isolated emulator/unit regression
 * tests; it cannot run in a production Node process. Never enable it in any
 * server/Functions account-deletion caller before the all-writer P0 review.
 */
export async function deleteAccountPhotos(
  bucket: Bucket, uid: string,
  mode: 'profile-only' | 'unsafe-emulator-test-only' = 'profile-only',
): Promise<boolean> {
  if (!uid || uid.includes('/') || uid === '.' || uid === '..') throw new Error('Invalid storage owner');
  if (mode !== 'profile-only' && mode !== 'unsafe-emulator-test-only') {
    throw new Error('invalid_account_photo_erasure_mode');
  }
  if (mode === 'unsafe-emulator-test-only') {
    // A test-only destructive override is never a production capability.
    // NODE_ENV may be unset on deployed runtimes: allowlist a local emulator
    // and an explicit test opt-in instead of merely rejecting "production".
    const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '';
    const isolatedLocalTest = process.env.NODE_ENV === 'test'
      && process.env.KLAR_TEST_VERIFICATION_DELETE === 'allow'
      && /^(127\.0\.0\.1|localhost|\[::1\]):[1-9][0-9]{1,4}$/.test(emulatorHost)
      && !process.env.K_SERVICE
      && !process.env.FUNCTION_TARGET
      && !process.env.VERCEL_ENV;
    if (!isolatedLocalTest) {
      throw new Error('verification_photo_p0_fencing_unverified');
    }
  }
  const verificationPrefix = `verification/${uid}/`;
  const assertNoUnfencedVerificationPhotos = async () => {
    const [files, next] = await bucket.getFiles({
      prefix: verificationPrefix, maxResults: 1, autoPaginate: false,
    });
    if (files.length > 0 || Boolean(next?.pageToken)) {
      throw new Error('verification_photo_p0_fencing_unverified');
    }
  };
  if (mode === 'profile-only') await assertNoUnfencedVerificationPhotos();

  let deleted = 0;
  let listed = 0;
  let more = false;
  const prefixes = mode === 'profile-only'
    ? [`profiles/${uid}/`]
    : [verificationPrefix, `profiles/${uid}/`];
  for (const prefix of prefixes) {
    const [files, next] = await bucket.getFiles({ prefix, maxResults: 100, autoPaginate: false });
    if (files.length > 100) throw new Error('storage_page_limit_exceeded');
    listed += files.length;
    more ||= Boolean(next?.pageToken);
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        // A legal/preservation hold field is trusted only when absent or
        // literally false. Malformed Storage metadata is not deletion consent.
        if (!metadata
          || (metadata.temporaryHold !== undefined && metadata.temporaryHold !== false)
          || (metadata.eventBasedHold !== undefined && metadata.eventBasedHold !== false)) {
          throw new Error('storage_object_held_or_invalid');
        }
        const generation = metadata.generation;
        if ((typeof generation !== 'string' && typeof generation !== 'number')
          || !/^[1-9][0-9]*$/.test(String(generation))
          || (typeof generation === 'number' && !Number.isSafeInteger(generation))) {
          throw new Error('Photo generation missing or invalid');
        }
        await file.delete({ ifGenerationMatch: generation });
        deleted++;
      } catch (error) {
        // Concurrent deletion is harmless, but is not evidence of our progress.
        // Conflicts (412), holds and service failures retain the failure budget.
        if ((error as { code?: number }).code !== 404) throw error;
      }
    }
  }
  // Recheck before reporting completion so a verification object added
  // during profile cleanup cannot be silently treated as erased. This check
  // alone is not an all-writer fence: concurrent creators still need the
  // independently reviewed account-deletion tombstone protocol.
  if (mode === 'profile-only') await assertNoUnfencedVerificationPhotos();
  if (!listed && !more) return true;
  if (!deleted) throw new Error('storage_erasure_no_progress');
  return false;
}


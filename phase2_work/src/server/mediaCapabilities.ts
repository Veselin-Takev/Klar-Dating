import { getAppBucket } from './storage';
import { getServerFirebaseApp } from './db';

/** Token deletion is metadata-only, including held evidence. It does not delete
 * the underlying object or change a legal hold. Conflicts remain retryable. */
export async function revokeAccountMediaCapabilities(uid: string, bucket = getAppBucket()): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('invalid_media_owner');
  for (const kind of ['profiles', 'verification']) {
    let pageToken: string | undefined;
    do {
      const [files, next] = await bucket.getFiles({ prefix: `${kind}/${uid}/`, maxResults: 100, autoPaginate: false, ...(pageToken ? {pageToken} : {}) });
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        if (!metadata.metadata?.firebaseStorageDownloadTokens) continue;
        if (!metadata.metageneration || !metadata.generation) throw new Error('media_metadata_unverified');
        const tokens = String(metadata.metadata.firebaseStorageDownloadTokens).split(',').filter(Boolean);
        if (tokens.length > 100 || tokens.some(token => token.length > 256)) throw new Error('media_metadata_unverified');
        await file.setMetadata({ metadata: {firebaseStorageDownloadTokens: null}, cacheControl: 'private, no-store' }, { ifMetagenerationMatch: metadata.metageneration });
        let [current] = await file.getMetadata();
        if (tokens.some(token => String(current.metadata?.firebaseStorageDownloadTokens ?? '').split(',').includes(token))) {
          // Firebase's token endpoint is needed by backends which maintain a
          // separate download-token index (including the native emulator).
          const app = getServerFirebaseApp(), emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
          if (emulator && (!app.options.projectId?.startsWith('demo-') || !/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(emulator))) throw new Error('invalid_storage_emulator');
          const credential = emulator ? 'owner' : (await app.options.credential?.getAccessToken())?.access_token;
          if (!credential) throw new Error('media_revocation_credentials_unavailable');
          for (const token of tokens) {
            const url = new URL(`/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(file.name)}`, emulator ? `http://${emulator}` : 'https://firebasestorage.googleapis.com');
            url.searchParams.set('delete_token', token);
            const response = await fetch(url, {method:'POST',headers:{authorization:`Bearer ${credential}`},redirect:'error',signal:AbortSignal.timeout(8_000)});
            if (!response.ok) throw new Error('media_revocation_unconfirmed');
            await response.body?.cancel();
          }
          [current] = await file.getMetadata();
        }
        if (String(current.generation) !== String(metadata.generation) || tokens.some(token => String(current.metadata?.firebaseStorageDownloadTokens ?? '').split(',').includes(token))) throw new Error('media_revocation_unconfirmed');
      }
      pageToken = next?.pageToken;
    } while (pageToken);
  }
}

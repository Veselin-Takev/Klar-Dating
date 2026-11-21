import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasUnsafeProfileDownloadUrlPersistence,
  inspectDirectProfileImageSources,
  inspectProfileMediaBoundary,
  profileStorageReadIsDenied,
} from './check-profile-media-boundary.mjs';

test('rejects direct img sources bound to protected profile media', () => {
  assert.equal(inspectDirectProfileImageSources('<img src={profile.photoUrl} alt="p" />').length, 1);
  assert.equal(inspectDirectProfileImageSources('<img src={modal.photoURL} />').length, 1);
  assert.equal(inspectDirectProfileImageSources('<img src="https://static.example/cover.jpg" />').length, 0);
  assert.equal(inspectDirectProfileImageSources('<AuthenticatedProfileImage src={profile.photoUrl} />').length, 0);
});

test('rejects persisting Firebase download URLs in profile source', () => {
  assert.equal(hasUnsafeProfileDownloadUrlPersistence("const url = await getDownloadURL(ref(storage, 'profiles/u1/a.jpg')); await updateDoc(profile, { photoURL: url });"), true);
  assert.equal(hasUnsafeProfileDownloadUrlPersistence("const url = await getDownloadURL(ref(storage, 'other/u1/a.jpg'));"), false);
});

test('requires direct profile Storage reads to remain denied', () => {
  assert.equal(profileStorageReadIsDenied("match /profiles/{uid}/{datei} { allow read: if false; allow write: if false; }"), true);
  assert.equal(profileStorageReadIsDenied("match /profiles/{uid}/{datei} { allow read: if request.auth != null; }"), false);
});

test('aggregates missing boundary controls without altering the source', () => {
  const violations = inspectProfileMediaBoundary({
    sourceFiles: [['src/Profile.tsx', '<img src={profile.photoUrl} />']],
    rootRules: "match /profiles/{uid}/{datei} { allow read: if true; }",
    phase2Rules: "match /profiles/{uid}/{datei} { allow read: if false; }",
    apiSource: "const url = input.toString();",
    serverSource: "app.use(helmet({ referrerPolicy: { policy: 'origin' } }));",
  });
  assert.equal(violations.length, 4);
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Structural regression guard for formerly unawaited and local-only profile writes.
// Browser + Firestore integration tests are still required for release approval.
const profile = readFileSync('src/screens/Profile.tsx', 'utf8');
const importSaveFailureMessages = (['de', 'en', 'es', 'fr'] as const).map(locale => {
  const catalog = JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')) as {
    profileScreen: { import: { saveFailed: string } };
  };
  return catalog.profileScreen.import.saveFailed;
});

describe('profile update persistence contract', () => {
  it('awaits both avatar upload and profile update before confirming success', () => {
    expect(profile).toContain('const url = await ladeProfilfotoHoch(croppedBlob)');
    expect(profile).toContain('await updateProfileData({ photoURL: url })');
    expect(profile).toContain('setIsUploadingPhoto(false)');
  });

  it('persists imported bio and interests before clearing user draft', () => {
    const start = profile.indexOf('const handleImport = async');
    const end = profile.indexOf('const [phase', start);
    const section = profile.slice(start, end < 0 ? undefined : end);
    expect(section).toContain('await updateProfileData(changes)');
    expect(section.indexOf('await updateProfileData(changes)')).toBeLessThan(section.indexOf("setImportText('')"));
    expect(section).toContain("setProfileActionMessage(t('profileScreen.import.saveFailed'))");

    const preservedInputCopy = [
      'Deine Eingabe bleibt erhalten',
      'Your input is still available',
      'Tu entrada sigue disponible',
      'Votre saisie est conservée',
    ];
    importSaveFailureMessages.forEach((message, index) => {
      expect(message).toContain(preservedInputCopy[index]);
    });
  });
});

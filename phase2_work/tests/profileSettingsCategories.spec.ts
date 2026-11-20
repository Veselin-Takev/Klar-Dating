import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/screens/Profile.tsx', 'utf8');
const locales = ['de', 'en', 'es', 'fr'] as const;
const categoryKeys = ['privacyCategory', 'preferencesCategory', 'advancedCategory'] as const;
const localizedCategoryLabels = locales.map(locale => {
  const catalog = JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')) as {
    profileScreen: { settings: Record<(typeof categoryKeys)[number], string> };
  };
  return categoryKeys.map(key => catalog.profileScreen.settings[key]);
});

describe('profile settings categories', () => {
  it('provides three localized, discoverable categories with accessible selection state', () => {
    for (const key of categoryKeys) {
      expect(source).toContain(`t('profileScreen.settings.${key}')`);
    }
    const germanAdvancedCategory = localizedCategoryLabels[0]?.[2];
    if (germanAdvancedCategory === undefined) {
      throw new Error('German advanced profile settings category is missing');
    }
    expect(germanAdvancedCategory).toBe('Erweitert & Konto');
    for (const labels of localizedCategoryLabels) {
      expect(labels).toHaveLength(3);
      expect(labels.every(label => label.trim().length > 0)).toBe(true);
      expect(new Set(labels).size).toBe(3);
    }
    expect(source).toContain('aria-pressed={settingsCategory === id}');
    expect(source).toContain('min-h-11');
  });

  it('does not unmount consent or account protection when switching categories', () => {
    expect(source).toContain("settingsCategory === 'privacy' ? 'space-y-4' : 'hidden'");
    expect(source).toContain('<ConsentSettings />');
    expect(source).toContain('<AboVerwaltung />');
    expect(source).toContain('handleDeleteAccount');
  });
});

import { describe, expect, it } from 'vitest';
import { createRequestI18n } from './config';

describe('request-scoped translation instances', () => {
  it('does not leak language changes between concurrent render contexts', async () => {
    const first = createRequestI18n('de');
    const second = createRequestI18n('en');
    await first.changeLanguage('fr');
    expect(first.t('settings.language')).toBe('Langue');
    expect(second.t('settings.language')).toBe('Language');
  });

  it('uses the German catalog as the single runtime fallback', () => {
    const instance = createRequestI18n('en');
    expect(instance.options.fallbackLng).toEqual(['de']);
    expect(instance.t('settings.language')).toBe('Language');
  });

  it('does not silently accept an inline default value for migrated UI strings', () => {
    const instance = createRequestI18n('en');
    expect(instance.t('settings.language', { defaultValue: 'SHOULD_NOT_BE_USED' })).toBe('Language');
  });
});

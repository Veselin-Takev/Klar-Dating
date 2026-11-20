import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createRequestI18n } from '../i18n/config';
import { QuickThemeToggle } from './QuickThemeToggle';

const mocks = vi.hoisted(() => ({ setTheme: vi.fn(), hapticFeedback: vi.fn() }));
vi.mock('./ThemeProvider', () => ({
  useTheme: () => ({ theme: 'light', setTheme: mocks.setTheme }),
}));
vi.mock('../lib/haptics', () => ({
  hapticFeedback: mocks.hapticFeedback,
  HAPTIC_PATTERNS: { LIGHT_TAP: 20 },
}));

beforeEach(() => vi.clearAllMocks());

describe('QuickThemeToggle accessibility', () => {
  it.each(['de', 'en', 'es', 'fr'] as const)('provides a localized accessible name and 44px target in %s', language => {
    const i18n = createRequestI18n(language);
    render(
      <I18nextProvider i18n={i18n}>
        <QuickThemeToggle />
      </I18nextProvider>,
    );
    const button = screen.getByRole('button', { name: i18n.t('theme.switchToDark') });
    expect(button).toHaveClass('min-h-11', 'min-w-11');
    fireEvent.click(button);
    expect(mocks.setTheme).toHaveBeenCalledWith('dark');
    expect(mocks.hapticFeedback).toHaveBeenCalledOnce();
  });
});

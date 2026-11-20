// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { FeedbackFormWidget } from '../src/components/FeedbackFormWidget';
import { createRequestI18n } from '../src/i18n/config';

const originalOnline = navigator.onLine;

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnline });
});

describe('profile feedback translations and accessible names', () => {
  it.each(['de', 'en', 'es', 'fr'] as const)('renders localized accessible controls in %s', language => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const i18n = createRequestI18n(language);
    render(
      <I18nextProvider i18n={i18n}>
        <FeedbackFormWidget />
      </I18nextProvider>
    );
    expect(screen.getByRole('button', { name: i18n.t('profileScreen.feedback.ratingLabel', { rating: 1 }) })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: i18n.t('profileScreen.feedback.suggestions') })).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('profileScreen.feedback.submit') })).toBeTruthy();
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import i18n from '../i18n/config';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('de');
  });

  it('offers all supported languages through a native keyboard-accessible control', () => {
    render(<LanguageSwitcher />);
    const control = screen.getByRole('combobox', { name: 'Sprache' });
    expect(control).toHaveValue('de');
    expect(control).toHaveAttribute('aria-busy', 'false');
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('option', { name: 'Deutsch' })).toHaveAttribute('lang', 'de');
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('lang', 'en');
  });

  it('changes the UI, document language and persistent device preference without navigation', async () => {
    render(<LanguageSwitcher />);
    const control = screen.getByRole('combobox', { name: 'Sprache' });
    fireEvent.change(control, { target: { value: 'en' } });

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en'));
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('klar_language')).toBe('en');
  });

  it.each(['de', 'en', 'es', 'fr'] as const)('normalizes the HTML root language to %s', async language => {
    await i18n.changeLanguage(language);
    expect(document.documentElement.lang).toBe(language);
  });
});

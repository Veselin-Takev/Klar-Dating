import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingMusic } from './OnboardingMusic';
import { I18nextProvider } from 'react-i18next';
import { createRequestI18n } from '../i18n/server';

describe('OnboardingMusic', () => {
  it('returns selected music preferences', () => {
    const onComplete = vi.fn();
    render(<I18nextProvider i18n={createRequestI18n('de')}><OnboardingMusic onBack={vi.fn()} onComplete={onComplete} /></I18nextProvider>);

    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByLabelText(/Konzerte/));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(onComplete).toHaveBeenCalledWith({
      genres: ['Rock'],
      concertGoer: true,
      playingInstrument: false,
    });
  });
  it('localizes genre labels while preserving stored matching identifiers', () => {
    const onComplete = vi.fn();
    render(<I18nextProvider i18n={createRequestI18n('en')}><OnboardingMusic onBack={vi.fn()} onComplete={onComplete} /></I18nextProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Classical' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onComplete).toHaveBeenCalledWith({ genres: ['Klassik'], concertGoer: false, playingInstrument: false });
  });
});

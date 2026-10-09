import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { createRequestI18n } from '../i18n/server';
import Onboarding from './Onboarding';

// This test isolates the real onboarding state machine from unrelated account preferences.
vi.mock('../components/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));

function selectMusicAndFinish(onComplete: () => Promise<void>) {
  render(<I18nextProvider i18n={createRequestI18n('de')}><Onboarding onComplete={onComplete} /></I18nextProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt startklar machen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Musik' }));
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
  fireEvent.click(screen.getByTestId('genre-jazz'));
  fireEvent.click(screen.getByLabelText('Ich gehe gerne auf Konzerte oder Festivals'));
  fireEvent.click(screen.getByLabelText('Ich spiele selbst ein Instrument'));
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Profile entdecken' }));
  const submit = screen.getByRole('button', { name: 'Loslegen & Verifizieren' });
  fireEvent.click(submit);
  return submit;
}

const selected = {
  interests: ['Musik'],
  musicPreferences: { genres: ['Jazz'], concertGoer: true, playingInstrument: true },
};

describe('onboarding persistence boundary', () => {
  it('retains the pending state and prevents duplicate submission until persistence resolves', async () => {
    let complete!: () => void;
    const pending = new Promise<void>(resolve => { complete = resolve; });
    const onComplete = vi.fn(() => pending);
    const submit = selectMusicAndFinish(onComplete);
    expect(onComplete).toHaveBeenCalledWith(selected);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onComplete).toHaveBeenCalledTimes(1);
    await act(async () => { complete(); await pending; });
    expect(submit).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports failed persistence and retries with the same selected preferences', async () => {
    const onComplete = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('write rejected'))
      .mockResolvedValueOnce(undefined);
    const submit = selectMusicAndFinish(onComplete);
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenNthCalledWith(1, selected);
    expect(onComplete).toHaveBeenNthCalledWith(2, selected);
  });
});

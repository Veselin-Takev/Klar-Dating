import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createRequestI18n } from '../i18n/config';
import type { Profile } from '../data';
import { DatePrepChecklistModal } from './DatePrepChecklistModal';
const mocks = vi.hoisted(() => ({ askAICoach: vi.fn() }));
vi.mock('../lib/api', () => ({ askAICoach: mocks.askAICoach }));
vi.mock('../lib/fehler', () => ({ melde: vi.fn() }));
const profile = { name: 'Mira', interests: ['Musik', 'Reisen'] } as unknown as Profile;
const renderModal = (onClose = vi.fn()) => {
  render(<I18nextProvider i18n={createRequestI18n('de')}><DatePrepChecklistModal profile={profile} isOpen onClose={onClose} userInterests={['Kunst']} /></I18nextProvider>);
  return onClose;
};
beforeEach(() => { vi.clearAllMocks(); mocks.askAICoach.mockResolvedValue(JSON.stringify(['Gemeinsames Thema'])); });
describe('DatePrepChecklistModal accessibility', () => {
  it('exposes a named modal and topic items as keyboard-operable pressed buttons', async () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Date-Prep Checkliste' });
    const topic = await screen.findByRole('button', { name: 'Gemeinsames Thema' });
    expect(topic).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(topic);
    expect(topic).toHaveAttribute('aria-pressed', 'true');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
  it('closes on Escape and retains an explicit close control', () => {
    const onClose = renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Date-Prep Checkliste' });
    expect(screen.getByRole('button', { name: 'Checkliste schließen' })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
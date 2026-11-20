import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { createRequestI18n } from '../i18n/config';
import { SICHTSCHUTZ_EIN, Sichtschutz, SichtschutzKnopf } from './Sichtschutz';
const storage = vi.hoisted(() => ({ getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('../lib/userScopedStorage', () => ({ klarStorage: storage }));
const renderWithI18n = (children: ReactNode) => render(<I18nextProvider i18n={createRequestI18n('de')}>{children}</I18nextProvider>);
beforeEach(() => vi.clearAllMocks());
describe('screen privacy accessibility', () => {
  it('opens the pause menu from the keyboard, supports both arrow directions, and restores trigger focus on Escape', () => {
    renderWithI18n(<SichtschutzKnopf />);
    const trigger = screen.getByRole('button', { name: 'Bildschirm verdecken' });
    fireEvent.keyDown(trigger, { key: 'ContextMenu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const pause = screen.getByRole('menuitem', { name: 'Automatischen Sichtschutz 5 Minuten pausieren' });
    const close = screen.getByRole('menuitem', { name: 'Sichtschutzoptionen schließen' });
    expect(pause).toHaveFocus();
    fireEvent.keyDown(pause, { key: 'ArrowDown' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'ArrowUp' });
    expect(pause).toHaveFocus();
    fireEvent.keyDown(pause, { key: 'ArrowUp' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('exposes the screen cover as a named modal and closes it with Escape', () => {
    renderWithI18n(<Sichtschutz />);
    fireEvent(window, new Event(SICHTSCHUTZ_EIN));
    const dialog = screen.getByRole('dialog', { name: 'Bildschirm verdeckt' });
    expect(screen.getByRole('button', { name: 'Wieder anzeigen' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

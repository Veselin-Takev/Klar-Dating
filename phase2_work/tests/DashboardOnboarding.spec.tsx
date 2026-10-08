import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DashboardOnboarding } from '../src/components/DashboardOnboarding';
import { fetchWithTimeout } from '../src/lib/api';
vi.mock('../src/lib/api', () => ({ fetchWithTimeout: vi.fn().mockResolvedValue({}) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
describe('dashboard introduction accessibility', () => {
  it('traps focus and restores it when Escape dismisses the dialog', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    render(<DashboardOnboarding />);
    const dialog = screen.getByRole('dialog', { name: 'Willkommen bei Klar' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const skip = screen.getByRole('button', { name: 'Einführung überspringen' });
    const next = screen.getByRole('button', { name: 'Weiter' });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(skip, { key: 'Tab', shiftKey: true });
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(skip, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(fetchWithTimeout).not.toHaveBeenCalledWith('/api/launch/founding-claim', expect.anything());
    trigger.remove();
  });
  it('announces progress and records completion only after the final step', () => {
    render(<DashboardOnboarding />);
    expect(screen.getByRole('status')).toHaveTextContent('Schritt 1 von 4');
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByRole('status')).toHaveTextContent('Schritt 4 von 4');
    fireEvent.click(screen.getByRole('button', { name: 'Loslegen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/launch/founding-claim', expect.anything());
    expect(localStorage.getItem('klar_onboarding_seen')).toBe('true');
  });
});

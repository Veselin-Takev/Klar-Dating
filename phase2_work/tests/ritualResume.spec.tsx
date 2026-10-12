import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsistencyStreakWidget } from '../src/components/ConsistencyStreakWidget';
import { klarStorage } from '../src/lib/userScopedStorage';

beforeEach(() => { vi.clearAllMocks(); });

describe('Ritual continuity pause restart', () => {
  it('exposes an accessible resume action and removes the vacation marker without resetting earned days', () => {
    const today = new Date();
    klarStorage.setItem('klar_rituals_streak', JSON.stringify({
      count: 6, lastDate: today.toISOString(), vacationUntil: new Date(today.getTime() + 7 * 86400000).toISOString(),
    }));
    render(<ConsistencyStreakWidget />);
    expect(screen.getByText(/Pausiert/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ritual-Pause beenden' }));
    expect(screen.queryByText(/Pausiert/)).not.toBeInTheDocument();
    const stored = JSON.parse(klarStorage.getItem('klar_rituals_streak') || '{}');
    expect(stored.count).toBe(6);
    expect(stored.vacationUntil).toBeUndefined();
    expect(stored.resumeGraceUntil).toEqual(expect.any(String));
  });
});

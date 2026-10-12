import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { BackNavigation } from '../src/components/BackNavigation';

function Destination() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}
describe('accessible back navigation', () => {
  it('uses safe fallback on a direct entry', () => {
    render(<MemoryRouter initialEntries={['/klar-plus']}>
      <BackNavigation fallback="/profile" />
      <Routes><Route path="*" element={<Destination />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile');
  });
  it('retains unsaved changes when user cancels confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/settings']}>
      <BackNavigation fallback="/profile" dirty />
      <Routes><Route path="*" element={<Destination />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
    confirm.mockRestore();
  });
});

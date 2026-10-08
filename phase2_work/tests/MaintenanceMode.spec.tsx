import { render, screen } from '@testing-library/react';
import { MaintenanceMode } from '../src/components/MaintenanceMode';
import { describe, it, expect } from 'vitest';

describe('MaintenanceMode Component', () => {
  it('renders default message correctly', () => {
    render(<MaintenanceMode />);
    expect(screen.getByText('Klar macht eine kurze Pause')).toBeInTheDocument();
    expect(screen.getByText(/Wir führen gerade wichtige Wartungsarbeiten durch/)).toBeInTheDocument();
  });

  it('renders custom message and estimated completion time', () => {
    render(
      <MaintenanceMode
        message="Datenbank-Update läuft."
        estimatedCompletion="14:00 Uhr"
      />
    );
    expect(screen.getByText('Datenbank-Update läuft.')).toBeInTheDocument();
    expect(screen.getByText('14:00 Uhr')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<MaintenanceMode />);
    const alertBox = screen.getByRole('alert');
    expect(alertBox).toHaveAttribute('aria-live', 'polite');
  });
});

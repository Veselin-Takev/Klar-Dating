import { render, screen, fireEvent } from '@testing-library/react';
import { MaintenanceOverlay } from '../src/components/MaintenanceOverlay';
import { describe, it, expect, vi } from 'vitest';

describe('MaintenanceOverlay Component', () => {
  it('renders default message, wrench icon, and accessibility attributes', () => {
    render(<MaintenanceOverlay />);

    const alertBox = screen.getByRole('alert');
    expect(alertBox).toBeInTheDocument();
    expect(alertBox).toHaveAttribute('aria-live', 'polite');

    expect(screen.getByText('Wir sind gleich zurück')).toBeInTheDocument();
    expect(
      screen.getByText(/Wir führen derzeit notwendige Wartungsarbeiten durch/)
    ).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-label', 'Wartungsfortschritt');
  });

  it('renders custom message, progress bar percentage, and step indicator', () => {
    render(
      <MaintenanceOverlay
        message="Server-Upgrade im Gange."
        progress={72}
        step="Schritt 3 von 4: Datenbank-Indizes"
      />
    );

    expect(screen.getByText('Server-Upgrade im Gange.')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('Schritt 3 von 4: Datenbank-Indizes')).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '72');
  });

  it('renders estimated completion time and countdown badge', () => {
    // 30 minutes in the future
    const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    render(
      <MaintenanceOverlay
        estimatedEndTime={futureTime}
      />
    );

    const waitContainer = screen.getByTestId('estimated-wait-container');
    expect(waitContainer).toBeInTheDocument();
    expect(screen.getByText('Geschätzte Wartezeit')).toBeInTheDocument();
    expect(screen.getByTestId('countdown-text')).toBeInTheDocument();
    expect(screen.getByText(/Voraussichtlich fertig um:/)).toBeInTheDocument();
  });

  it('handles retry button clicks', () => {
    const handleRetry = vi.fn();
    render(<MaintenanceOverlay onRetry={handleRetry} />);

    const retryBtn = screen.getByRole('button', { name: /Seite neu laden/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});

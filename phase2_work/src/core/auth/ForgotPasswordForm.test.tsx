import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import * as passwordResetService from './passwordResetService';

vi.mock('./passwordResetService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./passwordResetService')>();
  return {
    ...actual,
    requestPasswordReset: vi.fn(),
    confirmNewPassword: vi.fn(),
  };
});

describe('ForgotPasswordForm', () => {
  const mockBackToLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders request form components and explanation text correctly', () => {
    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} />);
    expect(screen.getByRole('heading', { name: /Passwort zurücksetzen/i })).toBeInTheDocument();
    expect(screen.getByText(/Gib deine registrierte E-Mail-Adresse ein/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-Mail-Adresse/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Link anfordern/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zurück zum Login/i })).toBeInTheDocument();
  });

  it('shows inline validation error when submitting with empty email', async () => {
    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} />);
    fireEvent.click(screen.getByRole('button', { name: /Link anfordern/i }));

    expect(screen.getByText(/Bitte gib deine E-Mail-Adresse ein/i)).toBeInTheDocument();
    expect(passwordResetService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows inline validation error when submitting invalid email format', async () => {
    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} />);
    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Link anfordern/i }));

    expect(screen.getByText(/Bitte gib eine gültige E-Mail-Adresse ein/i)).toBeInTheDocument();
    expect(passwordResetService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('allows toggling between Password-Link and Magic Link methods', () => {
    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} />);
    const magicTab = screen.getByRole('button', { name: /Direkt anmelden \(Magic Link\)/i });
    const passwordTab = screen.getByRole('button', { name: /Passwort-Link/i });

    expect(passwordTab).toBeInTheDocument();
    expect(magicTab).toBeInTheDocument();

    fireEvent.click(magicTab);
    expect(magicTab.className).toContain('bg-white');
  });

  it('displays neutral feedback screen on successful reset request and starts cooldown', async () => {
    vi.mocked(passwordResetService.requestPasswordReset).mockResolvedValueOnce({
      success: true,
      message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.',
    });

    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@klar.app' } });
    fireEvent.click(screen.getByRole('button', { name: /Link anfordern/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /E-Mail gesendet/i })).toBeInTheDocument();
      expect(screen.getByText(/Falls ein Konto mit dieser E-Mail-Adresse existiert/i)).toBeInTheDocument();
      expect(screen.getByText(/Prüfe auch deinen Spam- oder Junk-Ordner/i)).toBeInTheDocument();
      expect(screen.getByText(/Der Link ist aus Sicherheitsgründen für 15 Minuten gültig/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Erneut senden/i })).toBeDisabled();
    });
  });

  it('calls onBackToLogin when back button is clicked in request mode', () => {
    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} />);
    fireEvent.click(screen.getByRole('button', { name: /Zurück zum Login/i }));
    expect(mockBackToLogin).toHaveBeenCalledTimes(1);
  });

  it('renders reset password view when initialToken is provided', () => {
    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} initialToken="test-token-123" />);
    expect(screen.getByRole('heading', { name: /Neues Passwort wählen/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Neues Passwort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Passwort wiederholen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Passwort speichern & anmelden/i })).toBeInTheDocument();
  });

  it('shows password strength indicators and validates matching passwords in reset mode', async () => {
    vi.mocked(passwordResetService.confirmNewPassword).mockResolvedValueOnce({
      success: true,
      message: 'Passwort erfolgreich geändert.',
    });

    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} initialToken="test-token-123" />);

    // Type a strong password
    fireEvent.change(screen.getByLabelText(/^Neues Passwort/i), { target: { value: 'SicheresPasswort2026!' } });
    expect(screen.getByText(/Passwortstärke:/i)).toBeInTheDocument();
    expect(screen.getByText(/Stark/i)).toBeInTheDocument();

    // Type matching confirmation
    fireEvent.change(screen.getByLabelText(/^Passwort wiederholen/i), { target: { value: 'SicheresPasswort2026!' } });
    fireEvent.click(screen.getByRole('button', { name: /Passwort speichern & anmelden/i }));

    await waitFor(() => {
      expect(passwordResetService.confirmNewPassword).toHaveBeenCalledWith('test-token-123', 'SicheresPasswort2026!');
      expect(screen.getByRole('heading', { name: /Passwort erfolgreich geändert/i })).toBeInTheDocument();
      expect(screen.getByText(/Alle bestehenden Sitzungen auf anderen Geräten wurden abgemeldet/i)).toBeInTheDocument();
    });
  });

  it('displays error when password confirmation does not match', async () => {
    render(<ForgotPasswordForm onBackToLogin={mockBackToLogin} initialToken="test-token-123" />);

    fireEvent.change(screen.getByLabelText(/^Neues Passwort/i), { target: { value: 'SicheresPasswort2026!' } });
    fireEvent.change(screen.getByLabelText(/^Passwort wiederholen/i), { target: { value: 'AnderesPasswort2026!' } });
    fireEvent.click(screen.getByRole('button', { name: /Passwort speichern & anmelden/i }));

    await waitFor(() => {
      expect(screen.getByText(/Die eingegebenen Passwörter stimmen nicht überein/i)).toBeInTheDocument();
    });
    expect(passwordResetService.confirmNewPassword).not.toHaveBeenCalled();
  });
});

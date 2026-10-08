import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Layout } from '../src/components/Layout';
import { AuthGate } from '../src/components/AuthGate';
import * as AuthContextModule from '../src/lib/AuthContext';
import { EINWILLIGUNG_VERSION } from '../src/server/pure';

vi.mock('../src/screens/Login', () => ({
  default: () => <div data-testid="login-screen">Anmeldebildschirm</div>,
}));

vi.mock('../src/components/EinwilligungUndAlter', () => ({
  EinwilligungUndAlter: () => <div data-testid="consent-gate-screen">Einwilligung und Alter</div>,
}));

vi.mock('../src/screens/Onboarding', () => ({
  default: () => <div data-testid="onboarding-screen">Onboarding Bildschirm</div>,
}));

describe('Layout Component (UI Shell)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children within main content area and displays navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div data-testid="test-content">Dashboard Inhalt</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: /Hauptnavigation/i })).toHaveLength(2);
  });

  it('provides accessible skip-link to #inhalt', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Inhalt</div>
        </Layout>
      </MemoryRouter>
    );

    const skipLink = screen.getByRole('link', { name: /Zum Inhalt springen/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#inhalt');
  });
});

describe('AuthGate Component (Auth & Compliance Gating)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders LogoLoader when auth state is loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: true,
      profileData: null,
      updateProfileData: vi.fn(),
      refreshProfile: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <AuthGate>
          <div data-testid="protected-content">Geschützt</div>
        </AuthGate>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders Login screen when user is unauthenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      profileData: null,
      updateProfileData: vi.fn(),
      refreshProfile: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <AuthGate>
          <div data-testid="protected-content">Geschützt</div>
        </AuthGate>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('renders EinwilligungUndAlter gate when age is not verified or consent is missing (brauchtGate)', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { uid: 'user-123', isAnonymous: false } as any,
      loading: false,
      profileData: { isAdult: false, einwilligung: null } as any,
      updateProfileData: vi.fn(),
      refreshProfile: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthGate>
          <div data-testid="protected-content">Geschützt</div>
        </AuthGate>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('consent-gate-screen')).toBeInTheDocument();
  });

  it('renders protected children when user is adult, consented, and onboarded', () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { uid: 'user-123', isAnonymous: false } as any,
      loading: false,
      profileData: {
        isAdult: true,
        einwilligung: { version: EINWILLIGUNG_VERSION },
        interests: ['Reisen'],
      } as any,
      updateProfileData: vi.fn(),
      refreshProfile: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthGate>
          <div data-testid="protected-content">Geschützt</div>
        </AuthGate>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('consent-gate-screen')).not.toBeInTheDocument();
  });
});

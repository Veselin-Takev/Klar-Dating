import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimatedRoutes, LazyRoute, PageWrapper } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// Mock Screens for fast, isolated routing tests
vi.mock('./screens/Dashboard', () => ({
  default: () => <div data-testid="screen-dashboard">Dashboard Ansicht</div>,
}));

vi.mock('./screens/Chats', () => ({
  default: () => <div data-testid="screen-chats">Chats Übersicht</div>,
}));

vi.mock('./screens/ChatView', () => ({
  default: () => <div data-testid="screen-chatview">Chat Detailansicht</div>,
}));

vi.mock('./screens/Profile', () => ({
  default: () => <div data-testid="screen-profile">Profil Ansicht</div>,
}));

vi.mock('./screens/KlarPlus', () => ({
  default: () => <div data-testid="screen-klarplus">Klar Plus Ansicht</div>,
}));

vi.mock('./screens/SafetyCenter', () => ({
  default: () => <div data-testid="screen-safety">Sicherheitsbereich</div>,
}));

vi.mock('./screens/AICoach', () => ({
  default: () => <div data-testid="screen-aicoach">KI-Coach Ansicht</div>,
}));

vi.mock('./screens/Tips', () => ({
  default: () => <div data-testid="screen-tips">Dating-Tipps</div>,
}));

vi.mock('./screens/AdminDashboard', () => ({
  default: () => <div data-testid="screen-admin">Admin Dashboard</div>,
}));

vi.mock('./screens/Rechtstexte', () => ({
  default: () => <div data-testid="screen-rechtstexte">Rechtstexte Ansicht</div>,
}));

// Mock Diagnostics to prevent unhandled sentry events
vi.mock('./lib/diagnostics', () => ({
  reportClientError: vi.fn((_err: unknown) => {
    return 'test-error-event-1234';
  }),
}));

describe('App Routing & ErrorBoundary Test Suite', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    // Suppress expected React error boundary logs in test output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    vi.restoreAllMocks();
  });

  describe('AnimatedRoutes Path Switching', () => {
    it('renders the Dashboard screen at root path "/"', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AnimatedRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('screen-dashboard')).toBeInTheDocument();
      });
    });

    it('renders the Chats overview at path "/chats"', async () => {
      render(
        <MemoryRouter initialEntries={['/chats']}>
          <AnimatedRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('screen-chats')).toBeInTheDocument();
      });
    });

    it('renders ChatView with parameterized path "/chat/:id"', async () => {
      render(
        <MemoryRouter initialEntries={['/chat/session-99']}>
          <AnimatedRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('screen-chatview')).toBeInTheDocument();
      });
    });

    it('renders Profile and SafetyCenter on respective paths', async () => {
      const { unmount } = render(
        <MemoryRouter initialEntries={['/profile']}>
          <AnimatedRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('screen-profile')).toBeInTheDocument();
      });
      unmount();

      render(
        <MemoryRouter initialEntries={['/safety']}>
          <AnimatedRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('screen-safety')).toBeInTheDocument();
      });
    });

    it('renders Admin Dashboard at path "/admin"', async () => {
      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AnimatedRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('screen-admin')).toBeInTheDocument();
      });
    });

    it('switches views correctly upon path transitions', async () => {
      function NavigationTester() {
        const navigate = useNavigate();
        return (
          <div>
            <button onClick={() => navigate('/chats')} data-testid="nav-to-chats">
              Zu Chats
            </button>
            <button onClick={() => navigate('/profile')} data-testid="nav-to-profile">
              Zu Profil
            </button>
            <AnimatedRoutes />
          </div>
        );
      }

      render(
        <MemoryRouter initialEntries={['/']}>
          <NavigationTester />
        </MemoryRouter>
      );

      // Initial: Dashboard
      await waitFor(() => {
        expect(screen.getByTestId('screen-dashboard')).toBeInTheDocument();
      });

      // Navigation: /chats
      fireEvent.click(screen.getByTestId('nav-to-chats'));
      await waitFor(() => {
        expect(screen.getByTestId('screen-chats')).toBeInTheDocument();
        expect(screen.queryByTestId('screen-dashboard')).not.toBeInTheDocument();
      });

      // Navigation: /profile
      fireEvent.click(screen.getByTestId('nav-to-profile'));
      await waitFor(() => {
        expect(screen.getByTestId('screen-profile')).toBeInTheDocument();
        expect(screen.queryByTestId('screen-chats')).not.toBeInTheDocument();
      });
    });

    it('redirects unknown fallback routes back to "/" via NotFoundHandler', async () => {
      render(
        <MemoryRouter initialEntries={['/gibts-nicht-unbekannter-pfad']}>
          <AnimatedRoutes />
        </MemoryRouter>
      );

      // NotFoundHandler leitet automatisch via navigate('/', { replace: true }) weiter
      await waitFor(() => {
        expect(screen.getByTestId('screen-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('ErrorBoundary Logic & Load Failure Resilience', () => {
    it('catches dynamic loading or rendering failures in LazyRoute and displays the accessible alert UI', async () => {
      const CrashingComponent = () => {
        throw new Error('ChunkLoadError: Loading chunk 404 failed');
      };

      render(
        <MemoryRouter>
          <LazyRoute component={CrashingComponent} />
        </MemoryRouter>
      );

      // ErrorBoundary fängt den Fehler und zeigt das Alert-Element an
      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Ein unerwarteter Fehler ist aufgetreten.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /App neu laden/i })).toBeInTheDocument();
    });

    it('displays the generated error event ID when reported by diagnostics', async () => {
      const CrashingComponent = () => {
        throw new Error('Fatal network timeout during bundle load');
      };

      render(
        <MemoryRouter>
          <LazyRoute component={CrashingComponent} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Fehler-ID: test-error-event-1234/i)).toBeInTheDocument();
      });
    });

    it('isolates failures so healthy siblings or components remain intact', () => {
      const CrashingComponent = () => {
        throw new Error('Isolated sub-component failure');
      };

      render(
        <div>
          <div data-testid="healthy-header">Klar Navigationsleiste</div>
          <ErrorBoundary>
            <CrashingComponent />
          </ErrorBoundary>
          <div data-testid="healthy-footer">Klar Fusszeile</div>
        </div>
      );

      // Beide gesunden Komponenten sind weiterhin gerendert
      expect(screen.getByTestId('healthy-header')).toBeInTheDocument();
      expect(screen.getByTestId('healthy-footer')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('triggers window.location.reload when reload button is clicked', async () => {
      const reloadMock = vi.fn();
      const originalLocation = window.location;
      // Mock window.location.reload
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, reload: reloadMock },
      });

      const CrashingComponent = () => {
        throw new Error('Crash for reload verification');
      };

      render(
        <ErrorBoundary>
          <CrashingComponent />
        </ErrorBoundary>
      );

      const reloadBtn = await screen.findByRole('button', { name: /App neu laden/i });
      fireEvent.click(reloadBtn);
      expect(reloadMock).toHaveBeenCalledTimes(1);

      // Restore original location
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    });

    it('PageWrapper renders children inside motion container', () => {
      render(
        <PageWrapper>
          <div data-testid="wrapped-child">Seiteninhalt</div>
        </PageWrapper>
      );

      expect(screen.getByTestId('wrapped-child')).toBeInTheDocument();
    });
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { setDiagnosticsConsent } from "../lib/telemetryPrivacy";

vi.mock("@sentry/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/react")>();
  return {
    ...actual,
    captureException: vi.fn(() => "event-123"),
  };
});

function BrokenComponent(): never {
  throw new Error("test failure");
}

describe("ErrorBoundary privacy", () => {
  beforeEach(() => {
    localStorage.clear();
    setDiagnosticsConsent(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(Sentry.captureException).mockClear();
  });

  afterEach(() => {
    setDiagnosticsConsent(false);
    vi.restoreAllMocks();
  });

  it("does not transmit diagnostics without explicit consent", () => {
    localStorage.setItem("profile-draft", "sensitive");
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(
      screen.getByText("Es wurden keine Diagnosedaten übermittelt."),
    ).toBeInTheDocument();
  });

  it("transmits only a minimized context with consent", () => {
    setDiagnosticsConsent(true);
    localStorage.setItem("profile-draft", "sensitive");

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Sentry.captureException).mock.calls[0]).toHaveLength(1);
    expect(screen.getByText("Fehler-ID: event-123")).toBeInTheDocument();
  });
});


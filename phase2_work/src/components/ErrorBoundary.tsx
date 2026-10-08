import { Component } from "react";
import { reportClientError } from "../lib/diagnostics";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
  reported: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    eventId: null,
    reported: false,
  };

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught application error", error, errorInfo);

    const eventId = reportClientError(error);
    this.setState({ eventId, reported: eventId !== null });
  }

  public static getDerivedStateFromError(_: Error): Partial<State> {
    return { hasError: true };
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center h-[100dvh] p-6 text-center bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
        >
          <h1 className="text-xl font-bold mb-2">
            Ein unerwarteter Fehler ist aufgetreten.
          </h1>
          <p className="text-stone-600 dark:text-stone-300 mb-2">
            {this.state.reported
              ? "Der Fehlerbericht wurde mit deiner Einwilligung zur Übermittlung vorgemerkt."
              : "Es wurden keine Diagnosedaten übermittelt."}
          </p>
          {this.state.eventId && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-6 font-mono">
              Fehler-ID: {this.state.eventId}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 px-6 py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full font-medium shadow-sm hover:opacity-90 transition-opacity"
          >
            App neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}


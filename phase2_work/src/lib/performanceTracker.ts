/**
 * Global session performance tracker for development mode.
 * Tracks Firestore read operations and component render timings.
 */

class PerformanceMetrics {
  private firestoreReadsCount = 0;
  private renderDurations: Record<string, number> = {};
  private listeners: Array<() => void> = [];

  incrementFirestoreReads(count = 1) {
    this.firestoreReadsCount += count;
    this.notify();
  }

  getFirestoreReads(): number {
    return this.firestoreReadsCount;
  }

  recordRenderDuration(componentName: string, durationMs: number) {
    this.renderDurations[componentName] = Math.round(durationMs * 10) / 10;
    this.notify();
  }

  getRenderDurations(): Record<string, number> {
    return { ...this.renderDurations };
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  resetSession() {
    this.firestoreReadsCount = 0;
    this.renderDurations = {};
    this.notify();
  }
}

export const perfTracker = new PerformanceMetrics();

// Safe auto-instrumentation of Firestore reads in client runtime.
if (typeof window !== 'undefined') {
  type InstrumentableFn = ((...args: never[]) => Promise<unknown>) & { __instrumented?: boolean };
  type InstrumentableModule = {
    getDoc: InstrumentableFn;
    getDocs: InstrumentableFn;
    onSnapshot: ((...args: never[]) => unknown) & { __instrumented?: boolean };
  };

  import('firebase/firestore').then((module) => {
    const firestoreModule = module as unknown as InstrumentableModule;
    try {
      const origGetDoc = firestoreModule.getDoc;
      if (!origGetDoc.__instrumented) {
        const wrappedGetDoc = async (...args: never[]) => {
          perfTracker.incrementFirestoreReads(1);
          return origGetDoc(...args);
        };
        wrappedGetDoc.__instrumented = true;
        try { firestoreModule.getDoc = wrappedGetDoc; } catch {}
      }

      const origGetDocs = firestoreModule.getDocs;
      if (!origGetDocs.__instrumented) {
        const wrappedGetDocs = async (...args: never[]) => {
          const result = await origGetDocs(...args);
          const size = typeof result === 'object' && result !== null && 'size' in result && typeof result.size === 'number'
            ? result.size
            : 1;
          perfTracker.incrementFirestoreReads(size || 1);
          return result;
        };
        wrappedGetDocs.__instrumented = true;
        try { firestoreModule.getDocs = wrappedGetDocs; } catch {}
      }

      const origOnSnapshot = firestoreModule.onSnapshot;
      if (!origOnSnapshot.__instrumented) {
        const wrappedOnSnapshot = (...args: never[]) => {
          perfTracker.incrementFirestoreReads(1);
          return origOnSnapshot(...args);
        };
        wrappedOnSnapshot.__instrumented = true;
        try { firestoreModule.onSnapshot = wrappedOnSnapshot; } catch {}
      }
    } catch {}
  }).catch(() => {});
}

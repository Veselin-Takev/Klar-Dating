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

// Safe auto-instrumentation of Firestore reads in client runtime
if (typeof window !== 'undefined') {
  import('firebase/firestore').then((firestoreModule: unknown) => {
    try {
      const origGetDoc = firestoreModule.getDoc;
      if (origGetDoc && !origGetDoc.__instrumented) {
        const wrappedGetDoc = async function (this: unknown, ...args: unknown[]) {
          perfTracker.incrementFirestoreReads(1);
          return origGetDoc.apply(this, args);
        };
        wrappedGetDoc.__instrumented = true;
        try {
          firestoreModule.getDoc = wrappedGetDoc;
        } catch {}
      }

      const origGetDocs = firestoreModule.getDocs;
      if (origGetDocs && !origGetDocs.__instrumented) {
        const wrappedGetDocs = async function (this: unknown, ...args: unknown[]) {
          const res = await origGetDocs.apply(this, args);
          perfTracker.incrementFirestoreReads(res?.size || 1);
          return res;
        };
        wrappedGetDocs.__instrumented = true;
        try {
          firestoreModule.getDocs = wrappedGetDocs;
        } catch {}
      }

      const origOnSnapshot = firestoreModule.onSnapshot;
      if (origOnSnapshot && !origOnSnapshot.__instrumented) {
        const wrappedOnSnapshot = function (this: unknown, ...args: unknown[]) {
          perfTracker.incrementFirestoreReads(1);
          return origOnSnapshot.apply(this, args);
        };
        wrappedOnSnapshot.__instrumented = true;
        try {
          firestoreModule.onSnapshot = wrappedOnSnapshot;
        } catch {}
      }
    } catch {}
  }).catch(() => {});
}


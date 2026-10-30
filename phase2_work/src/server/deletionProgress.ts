import { AsyncLocalStorage } from 'node:async_hooks';

export class DeletionProviderPageComplete extends Error {
  constructor() { super('deletion_provider_progress'); this.name = 'DeletionProviderPageComplete'; }
}

export class DeletionStoragePageComplete extends Error {
  constructor() { super('deletion_storage_progress'); this.name = 'DeletionStoragePageComplete'; }
}

/** A completed destructive page is durable progress, not a failed attempt. */
export class DeletionPageComplete extends Error {
  constructor() {
    super('deletion_more_pages');
    this.name = 'DeletionPageComplete';
  }
}

/** A time-bounded slice committed mutations, but has not completed a chat page. */
export class DeletionTimeSliceComplete extends Error {
  constructor() {
    super('deletion_slice_progress');
    this.name = 'DeletionTimeSliceComplete';
  }
}

type DeletionSliceContext = {
  deadline: number;
  progressed: boolean;
  now: () => number;
  /** Optional internal instrumentation; never sourced from an HTTP request. */
  onProgress?: () => void;
};

const slices = new AsyncLocalStorage<DeletionSliceContext>();

export function runDeletionSlice<T>(
  work: () => Promise<T>,
  now: () => number = Date.now,
  onProgress?: () => void,
): Promise<T> {
  return slices.run({ deadline: now() + 45_000, progressed: false, now, onProgress }, work);
}

/** Call only after a mutation of known existing records has been acknowledged. */
export function recordDeletionProgress(): void {
  const slice = slices.getStore();
  if (slice) {
    slice.progressed = true;
    // Deterministic test seam: the callback observes ACKNOWLEDGED progress.
    // Production code does not supply this optional hook.
    slice.onProgress?.();
  }
}

export function checkDeletionSlice(): void {
  const slice = slices.getStore();
  if (!slice || slice.now() <= slice.deadline) return;
  if (slice.progressed) throw new DeletionTimeSliceComplete();
  throw new Error('deletion_time_slice');
}


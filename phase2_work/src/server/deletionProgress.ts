import { AsyncLocalStorage } from 'node:async_hooks';

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

const slices = new AsyncLocalStorage<{ deadline: number; progressed: boolean; now: () => number }>();

export function runDeletionSlice<T>(work: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  return slices.run({ deadline: now() + 45_000, progressed: false, now }, work);
}

/** Call only after a mutation of known existing records has been acknowledged. */
export function recordDeletionProgress(): void {
  const slice = slices.getStore();
  if (slice) slice.progressed = true;
}

export function checkDeletionSlice(): void {
  const slice = slices.getStore();
  if (!slice || slice.now() <= slice.deadline) return;
  if (slice.progressed) throw new DeletionTimeSliceComplete();
  throw new Error('deletion_time_slice');
}

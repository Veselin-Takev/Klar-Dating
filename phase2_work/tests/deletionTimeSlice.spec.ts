// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DeletionTimeSliceComplete, runDeletionSlice, checkDeletionSlice, recordDeletionProgress } from '../src/server/deletionProgress';

describe('bounded deletion progress', () => {
  it('treats expiry without a confirmed mutation as a real failure', async () => {
    let now = 0;
    await expect(runDeletionSlice(async () => {
      now = 45_001;
      checkDeletionSlice();
    }, () => now)).rejects.toThrow('deletion_time_slice');
  });

  it('yields without a failure only after confirmed progress in this invocation', async () => {
    let now = 0;
    await expect(runDeletionSlice(async () => {
      recordDeletionProgress();
      now = 45_001;
      checkDeletionSlice();
    }, () => now)).rejects.toBeInstanceOf(DeletionTimeSliceComplete);
  });

  it('does not replace a database failure with successful progress', async () => {
    const failure = new Error('commit failed');
    await expect(runDeletionSlice(async () => {
      recordDeletionProgress();
      throw failure;
    })).rejects.toBe(failure);
  });

  it('does not leak progress between concurrent accounts', async () => {
    let now = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const progress = runDeletionSlice(async () => {
      recordDeletionProgress();
      await barrier;
      checkDeletionSlice();
    }, () => now).catch(error => error);
    const noProgress = runDeletionSlice(async () => {
      await barrier;
      checkDeletionSlice();
    }, () => now).catch(error => error);
    now = 45_001; release();
    expect(await progress).toBeInstanceOf(DeletionTimeSliceComplete);
    const failed = await noProgress;
    expect(failed).toBeInstanceOf(Error);
    expect(failed).not.toBeInstanceOf(DeletionTimeSliceComplete);
    expect(failed.message).toBe('deletion_time_slice');
  });
});

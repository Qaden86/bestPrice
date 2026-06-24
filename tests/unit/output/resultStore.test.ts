import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendFile } = vi.hoisted(() => ({
  appendFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: { appendFile },
}));

import {
  flushResults,
  pendingWriteCount,
  upsertResult,
} from '@crawler/output/resultStore';

describe('resultStore', () => {
  beforeEach(async () => {
    appendFile.mockReset();
    await flushResults();
  });

  it('waits for an active drain and any rows queued behind it', async () => {
    let releaseFirstWrite!: () => void;
    appendFile
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirstWrite = resolve;
          }),
      )
      .mockResolvedValue(undefined);

    upsertResult(result('https://example.test/one'));
    await vi.waitFor(() => expect(appendFile).toHaveBeenCalledTimes(1));
    upsertResult(result('https://example.test/two'));

    let flushed = false;
    const flush = flushResults().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);

    releaseFirstWrite();
    await flush;

    expect(appendFile).toHaveBeenCalledTimes(2);
    expect(pendingWriteCount()).toBe(0);
  });

  it('retains a failed batch and lets flushResults retry it', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    appendFile
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);

    try {
      upsertResult(result('https://example.test/retry'));
      await vi.waitFor(() => expect(appendFile).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());

      expect(pendingWriteCount()).toBe(1);
      await flushResults();

      expect(appendFile).toHaveBeenCalledTimes(2);
      expect(pendingWriteCount()).toBe(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});

function result(url: string) {
  return {
    url,
    pdpPrice: 100,
    cartPrice: 100,
    match: true,
    status: 'OK' as const,
    reason: 'OK' as const,
    trace: [],
  };
}

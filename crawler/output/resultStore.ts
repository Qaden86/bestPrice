import { EventEmitter } from 'events';
import fsp from 'fs/promises';

import { RESULTS_PATH } from '../../config/path';
import type { CrawlResult } from '../types/CrawlResult';

export const resultBus = new EventEmitter();

const writeQueue: string[] = [];
let drainPromise: Promise<void> | null = null;

function drainQueue(): Promise<void> {
  if (!drainPromise) {
    drainPromise = (async () => {
      while (writeQueue.length > 0) {
        const batch = writeQueue.splice(0, 100).join('');
        await fsp.appendFile(RESULTS_PATH, batch, 'utf-8');
      }
    })().finally(() => {
      drainPromise = null;
      if (writeQueue.length > 0) void drainQueue();
    });
  }
  return drainPromise;
}

export function upsertResult(result: CrawlResult): void {
  const key =
    typeof result.url === 'string'
      ? result.url
      : (result.url as { url: string })?.url;
  if (!key) return;

  resultBus.emit('update', result);
  writeQueue.push(JSON.stringify(result) + '\n');
  void drainQueue();
}

export function flushResults(): Promise<void> {
  return (async () => {
    while (drainPromise || writeQueue.length > 0) {
      await drainQueue();
    }
  })();
}

export function pendingWriteCount(): number {
  return writeQueue.length;
}

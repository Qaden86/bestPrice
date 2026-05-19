import { EventEmitter } from 'events';
import fsp from 'fs/promises';

import { RESULTS_PATH } from '../../config/path';
import type { CrawlResult } from '../types/CrawlResult';

export const resultBus = new EventEmitter();

const writeQueue: string[] = [];
let drainActive = false;

function compactForPersist(result: CrawlResult): Omit<CrawlResult, 'trace'> & { trace?: never } {
  const { trace: _trace, ...rest } = result;
  return rest;
}

async function drainQueue(): Promise<void> {
  if (drainActive) return;
  drainActive = true;

  try {
    while (writeQueue.length > 0) {
      const batch = writeQueue.splice(0, 100).join('');
      await fsp.appendFile(RESULTS_PATH, batch, 'utf-8');
    }
  } finally {
    drainActive = false;
    if (writeQueue.length > 0) {
      void drainQueue();
    }
  }
}

export function upsertResult(result: CrawlResult): void {
  const key = typeof result.url === 'string' ? result.url : (result.url as { url: string })?.url;
  if (!key) return;

  const persisted = compactForPersist(result);
  resultBus.emit('update', persisted);
  writeQueue.push(JSON.stringify(persisted) + '\n');
  void drainQueue();
}

export function flushResults(): Promise<void> {
  return drainQueue();
}

export function pendingWriteCount(): number {
  return writeQueue.length;
}

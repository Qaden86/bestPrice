import { EventEmitter } from 'events';
import fsp from 'fs/promises';

import { RESULTS_PATH } from '../../config/path';

/**
 * NDJSON append + realtime bus.
 *
 * The dashboard reads the NDJSON file for snapshots and listens to `resultBus`
 * for live updates — no in-process accumulator is needed.
 */

export const resultBus = new EventEmitter();

/**
 * Serialize NDJSON appends. Fire-and-forget `fs.appendFile` lets libuv queue
 * many concurrent writes during a high-throughput crawl, retaining callbacks
 * and buffers. Chaining keeps at most one write pending.
 */
let writeChain: Promise<void> = Promise.resolve();

function appendNdjson(line: string): Promise<void> {
  writeChain = writeChain
    .catch(() => {})
    .then(() => fsp.appendFile(RESULTS_PATH, line, 'utf-8'));
  return writeChain;
}

export function upsertResult(result: any): void {
  const key = typeof result.url === 'string' ? result.url : result.url?.url;

  if (!key) return;

  resultBus.emit('update', result);

  void appendNdjson(JSON.stringify(result) + '\n');
}

/**
 * Drain pending appends — call before process exit so the last writes land.
 */
export function flushResults(): Promise<void> {
  return writeChain.catch(() => {});
}

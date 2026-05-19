import { EventEmitter } from 'events';
import fs from 'fs';

import { RESULTS_PATH } from '../../config/path';

/**
 * In-memory store for live crawl state; NDJSON append for dashboard replay.
 */

export const resultBus = new EventEmitter();

/**
 * In-memory state (authoritative)
 */
const store = new Map<string, any>();

/**
 * Upsert result into memory + emit event
 */
export function upsertResult(result: any): void {
  const key = typeof result.url === 'string' ? result.url : result.url?.url;

  if (!key) return;

  store.set(key, result);

  /**
   * realtime update for SSE
   */
  resultBus.emit('update', result);

  /**
   * append-only persistence log (non-blocking)
   */
  fs.appendFile(RESULTS_PATH, JSON.stringify(result) + '\n', () => {});
}
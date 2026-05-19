import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

/**
 * Memory store = SINGLE SOURCE OF TRUTH for runtime state
 * NDJSON = append-only log for debugging / replay
 */

const NDJSON_PATH = path.resolve(process.cwd(), 'data/results.ndjson');

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
  fs.appendFile(NDJSON_PATH, JSON.stringify(result) + '\n', () => {});
}
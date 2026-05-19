import path from 'path';

/**
 * Centralized filesystem paths
 */

export const DATA_DIR = path.resolve(process.cwd(), 'data');

export const RESULTS_PATH = path.resolve(
  DATA_DIR,
  'results.ndjson',
);

export const SCREENSHOTS_DIR = path.resolve(
  DATA_DIR,
  'screenshots',
);
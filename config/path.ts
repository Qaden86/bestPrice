import path from 'path';

/**
 * Centralized path registry.
 * Used by crawler + dashboard.
 */

export const RESULTS_PATH = path.resolve(process.cwd(), 'data/results.json');

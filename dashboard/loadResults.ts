import fs from 'fs';
import path from 'path';

const RESULTS_PATH = path.resolve(process.cwd(), 'data/results.json');

/**
 * Safe loader that always returns array
 */
export function loadResults(): any[] {
  try {
    if (!fs.existsSync(RESULTS_PATH)) {
      return [];
    }

    const raw = fs.readFileSync(RESULTS_PATH, 'utf-8');

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    /**
     * Normalize possible formats:
     * - array (correct)
     * - { results: [] }
     * - { data: [] }
     */
    if (Array.isArray(parsed)) return parsed;

    if (Array.isArray(parsed?.results)) return parsed.results;

    if (Array.isArray(parsed?.data)) return parsed.data;

    return [];
  } catch (e) {
    console.warn('[DASHBOARD] load failed:', e);
    return [];
  }
}

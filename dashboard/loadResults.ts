import fs from 'fs';
import path from 'path';

const RESULTS_PATH = path.resolve(process.cwd(), 'data/results.json');

/**
 * Safe loader that always returns normalized crawler results array.
 * Supports multiple historical formats for backward compatibility.
 */
export function loadResults(): any[] {
  try {
    if (!fs.existsSync(RESULTS_PATH)) {
      return [];
    }

    const raw = fs.readFileSync(RESULTS_PATH, 'utf-8');

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Case 1: already array
    if (Array.isArray(parsed)) return parsed;

    // Case 2: wrapped format { results: [] }
    if (Array.isArray(parsed?.results)) return parsed.results;

    // Case 3: wrapped format { data: [] }
    if (Array.isArray(parsed?.data)) return parsed.data;

    return [];
  } catch (e) {
    console.warn('[DASHBOARD] load failed:', e);
    return [];
  }
}

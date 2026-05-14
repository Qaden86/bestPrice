import fs from 'fs';
import { RESULTS_PATH } from '../../config/path';
import { ensureDataDir } from './ensureDataDir';

/**
 * Persist crawler results safely
 */
export function writeResults(results: any[]) {
  ensureDataDir();

  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: results.length,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
}

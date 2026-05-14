/**
 * Ensures that /data folder and results file exist.
 */

import fs from 'fs';
import path from 'path';
import { RESULTS_PATH } from '../../config/path';

export function ensureDataDir(): void {
  const dir = path.dirname(RESULTS_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(RESULTS_PATH)) {
    fs.writeFileSync(RESULTS_PATH, '[]', 'utf-8');
  }
}

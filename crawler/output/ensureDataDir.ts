import fs from 'fs';
import { DATA_DIR } from '../../config/path';

export function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

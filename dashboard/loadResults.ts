import fs from 'fs';
import path from 'path';

const NDJSON_PATH = path.resolve(
  process.cwd(),
  'data/results.ndjson',
);

/**
 * NDJSON is cross-process source of truth
 */
export function loadResults(): any[] {
  try {
    if (!fs.existsSync(NDJSON_PATH)) {
      return [];
    }

    const raw = fs.readFileSync(
      NDJSON_PATH,
      'utf-8',
    );

    if (!raw) return [];

    const lines = raw
      .split('\n')
      .filter(Boolean);

    const map = new Map<string, any>();

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        const key =
          typeof parsed.url === 'string'
            ? parsed.url
            : parsed.url?.url;

        if (!key) continue;

        map.set(key, parsed);
      } catch {
        continue;
      }
    }

    return Array.from(map.values());
  } catch {
    return [];
  }
}
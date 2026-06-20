import { readNdjson } from './readNdjson';

/**
 * URLs already present in the NDJSON log (last line per URL wins).
 */
export function loadCompletedUrlSet(filePath: string): Set<string> {
  const urls = new Set<string>();

  for (const row of readNdjson(filePath)) {
    const key =
      typeof row.url === 'string' ? row.url : (row.url as { url?: string })?.url;
    if (key) {
      urls.add(key);
    }
  }

  return urls;
}

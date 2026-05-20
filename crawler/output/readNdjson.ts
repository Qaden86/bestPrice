import fs from 'fs';

export function readNdjson(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, 'utf-8');
  if (!raw) return [];

  const map = new Map<string, any>();

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      const key = typeof parsed.url === 'string' ? parsed.url : parsed.url?.url;
      if (key) map.set(key, parsed);
    } catch {
      continue;
    }
  }

  return Array.from(map.values());
}

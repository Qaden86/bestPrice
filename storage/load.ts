import fs from 'fs/promises';
import path from 'path';

export async function loadResults() {

  const file = path.join(
    process.cwd(),
    'storage/results.json'
  );

  const raw = await fs.readFile(file, 'utf-8');

  return JSON.parse(raw);
}
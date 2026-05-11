import { worker } from './worker';
import { saveResults } from '../storage/save';

export async function fullCrawl(urls: string[]) {
  const chunkSize = Math.ceil(urls.length / 5);

  const chunks: string[][] = [];

  for (let i = 0; i < urls.length; i += chunkSize) {
    chunks.push(urls.slice(i, i + chunkSize));
  }

  const results = await Promise.all([
    worker(chunks[0] || [], 1),
    worker(chunks[1] || [], 2),
    worker(chunks[2] || [], 3),
    worker(chunks[3] || [], 4),
    worker(chunks[4] || [], 5),
  ]);

  const flat = results.flat();

  console.log('RESULTS COUNT:', flat.length);

  await saveResults(flat);

  return flat;
}
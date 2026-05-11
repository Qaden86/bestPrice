import fs from 'fs';

export async function saveResults(data: any) {
  fs.writeFileSync(
    './storage/results.json',
    JSON.stringify(data, null, 2)
  );
}
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadCompletedUrlSet } from '@crawler/output/resume';

describe('loadCompletedUrlSet', () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const file of tmpFiles) {
      fs.unlinkSync(file);
    }
    tmpFiles.length = 0;
  });

  it('returns unique URLs from NDJSON (last line wins)', () => {
    const file = path.join(
      os.tmpdir(),
      `resume-test-${Date.now()}.ndjson`,
    );
    tmpFiles.push(file);

    fs.writeFileSync(
      file,
      [
        JSON.stringify({ url: 'https://a.test/1', status: 'OK' }),
        JSON.stringify({ url: 'https://a.test/2', status: 'FAIL' }),
        JSON.stringify({ url: 'https://a.test/1', status: 'FAIL' }),
      ].join('\n'),
      'utf-8',
    );

    const set = loadCompletedUrlSet(file);
    expect(set.size).toBe(2);
    expect(set.has('https://a.test/1')).toBe(true);
    expect(set.has('https://a.test/2')).toBe(true);
  });

  it('returns empty set for missing file', () => {
    expect(loadCompletedUrlSet('/nonexistent/path.ndjson').size).toBe(0);
  });
});

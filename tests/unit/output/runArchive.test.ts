import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('run archive', () => {
  const originalCwd = process.cwd();
  let temporaryDirectory = '';

  afterEach(() => {
    process.chdir(originalCwd);
    if (temporaryDirectory) {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
    vi.resetModules();
  });

  it('does not archive a completed run a second time', async () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bestprice-'));
    process.chdir(temporaryDirectory);
    fs.mkdirSync('data/runs', { recursive: true });
    fs.writeFileSync(
      'data/results.ndjson',
      `${JSON.stringify({
        url: 'https://example.test/product',
        status: 'OK',
        reason: 'OK',
        match: true,
      })}\n`,
    );

    const archive = await import('@crawler/output/runArchive');
    archive.writeRunManifest('run-1', new Date().toISOString());

    expect(archive.archiveCurrentRunIfAny()).toBeNull();
    expect(fs.readdirSync('data/runs')).toEqual(['run-1']);
  });
});

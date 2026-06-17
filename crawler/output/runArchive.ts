import fs from 'fs';
import path from 'path';

import { DATA_DIR, RESULTS_PATH, RUNS_DIR } from '../../config/path';
import { readNdjson } from './readNdjson';

export type RunManifest = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  total: number;
  ok: number;
  failed: number;
  reasons: Record<string, number>;
};

export function archiveCurrentRunIfAny(): string | null {
  if (!fs.existsSync(RESULTS_PATH)) return null;

  const stat = fs.statSync(RESULTS_PATH);
  if (stat.size === 0) return null;

  const runId = stat.mtime.toISOString().replace(/[:.]/g, '-');
  const destDir = path.join(RUNS_DIR, runId);

  fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(RESULTS_PATH, path.join(destDir, 'results.ndjson'));

  const results = readNdjson(path.join(destDir, 'results.ndjson'));
  const manifest = buildManifest(runId, results, stat.mtime.toISOString());

  fs.writeFileSync(
    path.join(destDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  return runId;
}

export function writeRunManifest(runId: string, startedAt: string): void {
  const results = readNdjson(RESULTS_PATH);
  const manifest = buildManifest(
    runId,
    results,
    new Date().toISOString(),
    startedAt,
  );

  const destDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(destDir, { recursive: true });

  fs.copyFileSync(RESULTS_PATH, path.join(destDir, 'results.ndjson'));
  fs.writeFileSync(
    path.join(destDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
}

function buildManifest(
  runId: string,
  results: Array<{ status?: string; match?: boolean; reason?: string }>,
  finishedAt: string,
  startedAt?: string,
): RunManifest {
  const reasons: Record<string, number> = {};

  for (const r of results) {
    const key = r.reason ?? 'UNKNOWN';
    reasons[key] = (reasons[key] ?? 0) + 1;
  }

  const ok = results.filter((r) => r.status === 'OK' && r.match).length;

  return {
    runId,
    startedAt: startedAt ?? finishedAt,
    finishedAt,
    total: results.length,
    ok,
    failed: results.length - ok,
    reasons,
  };
}

export function listArchivedRuns(): RunManifest[] {
  if (!fs.existsSync(RUNS_DIR)) return [];

  return fs
    .readdirSync(RUNS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifestPath = path.join(RUNS_DIR, d.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) return null;
      try {
        return JSON.parse(
          fs.readFileSync(manifestPath, 'utf-8'),
        ) as RunManifest;
      } catch {
        return null;
      }
    })
    .filter((m): m is RunManifest => m != null)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

export function ensureRunsDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
  }
}

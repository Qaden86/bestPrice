import { getAppConfig } from './appConfig';

export const BASE_URL = getAppConfig().baseUrl;

export const SITEMAP_REQUEST_TIMEOUT_MS = Number(
  process.env.SITEMAP_REQUEST_TIMEOUT_MS ?? 15000,
);

const DEFAULT_SITEMAP_LIMIT = 50;
const DEFAULT_SITEMAP_CONCURRENCY = 10;

export function getSitemapLimit(): number | undefined {
  const raw = process.env.SITEMAP_LIMIT;
  if (!raw) return DEFAULT_SITEMAP_LIMIT;
  if (raw.toLowerCase() === 'all') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SITEMAP_LIMIT;
}

export function getSitemapConcurrency(): number {
  const raw = process.env.SITEMAP_CONCURRENCY;
  if (!raw) return DEFAULT_SITEMAP_CONCURRENCY;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SITEMAP_CONCURRENCY;
}

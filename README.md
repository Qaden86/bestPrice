# BestPrice UA

Playwright-based price crawler and UI tests for [bestprice.com.ua](https://bestprice.com.ua).

## Pipeline

```
Sitemap → URL filter → concurrent workers → crawl → result store → dashboard
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run crawl:stage` | Crawl using `.env.stage` |
| `npm run crawl:prod` | Crawl using `.env.prod` |
| `npm run crawl:stage:sample` | Sample run (see `EXECUTION_MODE`) |
| `npm run crawl:stage:full` | Full sitemap run |
| `npm run dashboard` | Results UI at http://localhost:3000 |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright tests |

## Environment

Copy `.env.example` and create `.env.stage` / `.env.prod`:

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Site origin |
| `NODE_ENV` | `stage` or `prod` (concurrency defaults) |
| `EXECUTION_MODE` | `full` or `sample` |
| `SAMPLE_SIZE` | URLs in sample mode (default `100`) |
| `CRAWL_CONCURRENCY` | Worker count override |

## Layout

- `scripts/run-crawl.ts` — crawl entrypoint
- `crawler/` — ingestion, engine, extraction, validation
- `dashboard/` — Express API + static UI
- `tests/header/` — header UI tests (POM in `src/`)
- `tests/e2e/` — crawl smoke test

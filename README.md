# BestPrice UA — E2E Automation Framework

End-to-end test automation framework for [bestprice.com.ua](https://bestprice.com.ua) built with **TypeScript** and **Playwright**. The framework follows the Page Object Model, supports parallel cross-browser execution, and produces rich HTML/Allure reports out of the box.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Reports](#reports)
- [Writing Tests](#writing-tests)
- [Page Object Model](#page-object-model)
- [Test Data](#test-data)
- [CI/CD](#cicd)
- [Code Quality](#code-quality)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Tool                    | Purpose                          |
| ----------------------- | -------------------------------- |
| **Playwright**          | Browser automation & test runner |
| **TypeScript**          | Static typing                    |
| **Node.js (>=18)**      | Runtime                          |
| **Allure Report**       | Rich HTML reporting              |
| **ESLint + Prettier**   | Code style & static analysis     |
| **Husky + lint-staged** | Pre-commit hooks                 |
| **GitHub Actions**      | CI pipeline                      |
| **dotenv**              | Environment variable management  |

---

## Project Structure

```
bestPrice/
├── src/
│   ├── pages/              # Page Object classes
│   │   ├── BasePage.ts
│   │   ├── HomePage.ts
│   │   ├── SearchResultsPage.ts
│   │   ├── ProductPage.ts
│   │   ├── CartPage.ts
│   │   └── CheckoutPage.ts
│   ├── components/         # Reusable UI components (header, footer, modals)
│   ├── fixtures/           # Custom Playwright fixtures
│   ├── helpers/            # Utility functions (date, string, api)
│   ├── api/                # API clients for backend calls
│   └── types/              # Shared TypeScript types & interfaces
├── tests/
│   ├── e2e/                # End-to-end UI scenarios
│   ├── api/                # API-level tests
│   └── smoke/              # Smoke suite
├── data/                   # Test data (JSON, fixtures)
├── config/
│   └── env/                # Per-environment configs (.dev, .stage, .prod)
├── reports/                # Generated reports (gitignored)
├── playwright.config.ts    # Playwright runner config
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
├── .env.example
└── package.json
```

---

## Prerequisites

- **Node.js** `>= 18.x`
- **npm** `>= 9.x` (or `pnpm`/`yarn`)
- Git

Verify installation:

```bash
node -v
npm -v
```

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/bestPrice.git
cd bestPrice

# 2. Install dependencies
npm ci

# 3. Install Playwright browsers
npx playwright install --with-deps

# 4. Copy environment template
cp .env.example .env
```

---

## Configuration

### Environment variables

Create a `.env` file at the project root (use `.env.example` as a template):

```env
BASE_URL=https://bestprice.com.ua
ENV=prod
HEADLESS=true
DEFAULT_TIMEOUT=30000
RETRIES=1
WORKERS=4

# Test user credentials
USER_EMAIL=qa.user@example.com
USER_PASSWORD=********

# API
API_BASE_URL=https://api.bestprice.com.ua
API_TOKEN=********
```

### `playwright.config.ts` highlights

- Multiple projects: `chromium`, `firefox`, `webkit`, `Mobile Chrome`, `Mobile Safari`
- Auto-waiting expectations and trace collection on failure
- HTML + Allure reporters
- Configurable retries and workers via env vars

---

## Running Tests

```bash
# All tests in all browsers
npm test

# A specific suite
npm run test:smoke
npm run test:e2e
npm run test:api

# Single project (browser)
npx playwright test --project=chromium

# Single file or test by title
npx playwright test tests/e2e/search.spec.ts
npx playwright test -g "user can add product to cart"

# Headed / debug / UI modes
npm run test:headed
npm run test:debug
npm run test:ui

# Update snapshots
npx playwright test --update-snapshots
```

### Suggested `package.json` scripts

```json
{
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "test:e2e": "playwright test tests/e2e",
    "test:api": "playwright test tests/api",
    "test:headed": "playwright test --headed",
    "test:debug": "PWDEBUG=1 playwright test",
    "test:ui": "playwright test --ui",
    "report": "playwright show-report",
    "allure:generate": "allure generate ./reports/allure-results -o ./reports/allure-report --clean",
    "allure:open": "allure open ./reports/allure-report",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"**/*.{ts,json,md}\"",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## Reports

### Playwright HTML report

```bash
npm run report
```

### Allure report

```bash
npm run allure:generate
npm run allure:open
```

Traces, screenshots, and videos are automatically attached on failure (`reports/` directory, gitignored).

---

## Writing Tests

Tests live under `tests/` and use Playwright's test runner with custom fixtures.

```ts
import { test, expect } from '../src/fixtures/baseFixture';

test.describe('Search @smoke', () => {
  test('user can search for a product by keyword', async ({
    homePage,
    searchResultsPage,
  }) => {
    await homePage.open();
    await homePage.search('iPhone 15');

    await expect(searchResultsPage.results).not.toHaveCount(0);
    await expect(searchResultsPage.firstResultTitle).toContainText(
      /iPhone 15/i,
    );
  });
});
```

### Tags

Use grep tags to slice the suite: `@smoke`, `@regression`, `@critical`, `@api`.

```bash
npx playwright test --grep "@smoke|@critical"
```

---

## Page Object Model

Each page extends `BasePage` and exposes locators + business actions — **no assertions inside POMs**.

```ts
// src/pages/HomePage.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  readonly searchInput: Locator;
  readonly searchButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByRole('searchbox', { name: /пошук/i });
    this.searchButton = page.getByRole('button', { name: /знайти/i });
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }
}
```

---

## Test Data

- Static data — JSON files under `data/`
- Generated data — [`@faker-js/faker`](https://fakerjs.dev/)
- Sensitive data — `.env` only (never committed)

```ts
import { faker } from '@faker-js/faker';

const user = {
  email: faker.internet.email(),
  password: faker.internet.password({ length: 12 }),
};
```

---

## CI/CD

Sample GitHub Actions workflow (`.github/workflows/playwright.yml`):

```yaml
name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 2 * * *' # nightly regression

jobs:
  test:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run lint
      - run: npm test
        env:
          BASE_URL: ${{ vars.BASE_URL }}
          USER_EMAIL: ${{ secrets.USER_EMAIL }}
          USER_PASSWORD: ${{ secrets.USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

---

## Code Quality

- **ESLint** — `npm run lint`
- **Prettier** — `npm run format`
- **TypeScript** strict mode — `npm run typecheck`
- **Husky** runs `lint-staged` on every commit

---

## Troubleshooting

| Issue                                          | Fix                                                       |
| ---------------------------------------------- | --------------------------------------------------------- |
| `browserType.launch: Executable doesn't exist` | `npx playwright install --with-deps`                      |
| Flaky timeouts                                 | Increase `DEFAULT_TIMEOUT` in `.env` or use `expect.poll` |
| Cannot reach bestprice.com.ua                  | Check VPN / regional access; site may geo-block requests  |
| Allure command not found                       | `npm i -D allure-commandline` or install Allure globally  |

---

## License

MIT — see [LICENSE](./LICENSE).

## Maintainers

QA Automation Team — open an issue or ping in the team chat.

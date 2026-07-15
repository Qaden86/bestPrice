/**
 * Application-level configuration
 *
 * Contains environment-specific business constants
 */

export interface AppConfig {
  baseUrl: string;
}

const DEFAULT_BASE_URL = 'https://bestprice.com.ua';

export function parseBaseUrl(
  value: string | undefined,
  options: { required?: boolean } = {},
): string {
  if (!value?.trim()) {
    if (options.required) {
      throw new Error('BASE_URL is required in CI');
    }
    return DEFAULT_BASE_URL;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`BASE_URL must be a valid URL, received: ${value}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('BASE_URL must use the http or https protocol');
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('BASE_URL must contain only the site origin');
  }

  return url.origin;
}

export function getAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    baseUrl: parseBaseUrl(env.BASE_URL, { required: env.CI === 'true' }),
  };
}

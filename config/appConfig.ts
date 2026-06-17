/**
 * Application-level configuration
 *
 * Contains environment-specific business constants
 */

export interface AppConfig {
  baseUrl: string;
}

export function getAppConfig(): AppConfig {
  return {
    baseUrl: process.env.BASE_URL ?? 'https://bestprice.com.ua',
  };
}

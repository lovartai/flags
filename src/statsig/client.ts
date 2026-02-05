/**
 * Statsig client initialization module.
 * Provides singleton pattern for StatsigClient.
 */

import { StatsigClient, type StatsigOptions, type StatsigUser } from '@statsig/js-client';

import { type Logger, setLogger } from '../logger';

let client: StatsigClient | null = null;
let testEnvDetector: (() => boolean) | null = null;

export interface InitOptions extends StatsigOptions {
  /**
   * Test environment indicator.
   * When true or returns true, testOverride values will be used.
   *
   * - `boolean`: static value
   * - `() => boolean`: dynamic function
   * - `undefined`: testOverride disabled
   */
  isTestEnv?: boolean | (() => boolean);

  /**
   * Custom logger implementation.
   */
  logger?: Logger;
}

/**
 * Initialize Statsig client (singleton).
 *
 * @example
 * ```ts
 * initStatsigClient('client-xxx', { userID: 'user-123' }, {
 *   environment: { tier: 'production' },
 *   isTestEnv: () => Boolean(window.__E2E__),
 * });
 * ```
 */
export function initStatsigClient(
  clientKey: string,
  user: StatsigUser,
  options?: InitOptions,
): StatsigClient {
  if (client) return client;

  const { isTestEnv, logger, ...statsigOptions } = options ?? {};

  // Set custom logger
  if (logger) {
    setLogger(logger);
  }

  // Store test env detector
  if (typeof isTestEnv === 'function') {
    testEnvDetector = isTestEnv;
  } else if (typeof isTestEnv === 'boolean') {
    testEnvDetector = () => isTestEnv;
  }
  // else: undefined, testOverride disabled

  client = new StatsigClient(clientKey, user, statsigOptions);
  client.initializeSync();
  return client;
}

/**
 * Get Statsig client synchronously.
 *
 * @throws Error if not initialized
 */
export function getStatsigClientSync(): StatsigClient {
  if (!client) {
    throw new Error('[statsig] Not initialized. Call initStatsigClient() first.');
  }
  return client;
}

/**
 * Check if currently in test environment.
 * Returns false if isTestEnv was not configured.
 */
export function isTestEnv(): boolean {
  return testEnvDetector?.() ?? false;
}

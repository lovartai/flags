/**
 * Statsig client initialization module.
 * Provides singleton pattern for StatsigClient.
 */

import { StatsigClient, type StatsigOptions, type StatsigUser } from '@statsig/js-client';

import { getLogger, type Logger, setLogger } from './logger';

let client: StatsigClient | null = null;
let testEnvDetector: (() => boolean) | null = null;

/**
 * Bootstrap data structure for server-side rendering.
 * Pass this from your BFF/SSR layer to enable zero-network initialization.
 */
export interface StatsigBootstrap {
  user?: StatsigUser;
  data: string;
}

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

  /**
   * Bootstrap data from server (enables zero-network init).
   * The data will be set before initializeSync() is called.
   */
  bootstrap?: StatsigBootstrap | null;
}

/**
 * Initialize Statsig client (singleton).
 *
 * @example
 * ```ts
 * // Basic initialization
 * initStatsigClient('client-xxx', { userID: 'user-123' }, {
 *   environment: { tier: 'production' },
 *   isTestEnv: () => Boolean(window.__E2E__),
 * });
 *
 * // With server-side bootstrap (zero network)
 * initStatsigClient('client-xxx', { userID: 'user-123' }, {
 *   environment: { tier: 'production' },
 *   bootstrap: { data: '...' },
 * });
 * ```
 */
export function initStatsigClient(
  clientKey: string,
  user: StatsigUser,
  options?: InitOptions,
): StatsigClient {
  if (client) return client;

  const { isTestEnv, logger, bootstrap, ...statsigOptions } = options ?? {};

  // Set custom logger
  if (logger) {
    setLogger(logger);
  }

  const log = getLogger();

  // Store test env detector
  if (typeof isTestEnv === 'function') {
    testEnvDetector = isTestEnv;
  } else if (typeof isTestEnv === 'boolean') {
    testEnvDetector = () => isTestEnv;
  }
  // else: undefined, testOverride disabled

  // Log initialization mode
  if (bootstrap) {
    log(`Initializing with bootstrap data (userID: '${user.userID}')`);
  } else {
    log(`Initializing in default mode (userID: '${user.userID}')`);
  }

  client = new StatsigClient(clientKey, user, statsigOptions);

  // Set bootstrap data before initializeSync (enables zero-network init)
  if (bootstrap?.data) {
    client.dataAdapter.setData(bootstrap.data);
  }

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
    throw new Error('[@lovart-open/statsig] Not initialized. Call initStatsigClient() first.');
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

/**
 * Feature Flags factory module.
 * Use createFlagStore to create type-safe flag stores and hooks.
 */

import { useFeatureGate } from '@statsig/react-bindings';

import { getStatsigClientSync, isTestEnv } from './client';
import type { EvaluationOptions, FeatureGate, FlagDefinition, FlagSnapshot, FlagState } from './types';

export interface ResolveOptions extends EvaluationOptions {
  gate?: FeatureGate;
  search?: string;
}

const TRUE_LITERALS = new Set(['1', 'true']);
const hasWindow = typeof window !== 'undefined';

/**
 * Parse URL query string for flag overrides.
 * Format: ?ff.flag_name=1 or ?ff.flag_name=true
 */
export function parseUrlOverrides(search?: string): Record<string, boolean> {
  if (!hasWindow && !search) return {};
  const searchString = search ?? (hasWindow ? window.location.search : '');
  const params = new URLSearchParams(searchString);
  const overrides: Record<string, boolean> = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith('ff.')) {
      overrides[key.slice(3)] = TRUE_LITERALS.has(value.trim().toLowerCase());
    }
  }
  return overrides;
}

/**
 * Type-safe FlagStore class.
 */
export class FlagStore<TDefinitions extends Record<string, FlagDefinition>> {
  private readonly definitions: TDefinitions;

  constructor(definitions: TDefinitions) {
    this.definitions = definitions;
  }

  /** Get snapshot of all flag states */
  get snapshot(): FlagSnapshot<Extract<keyof TDefinitions, string>> {
    const next: any = {};
    for (const key in this.definitions) {
      next[key] = this.resolve(key as any);
    }
    return next;
  }

  /** Get flag boolean value */
  getFlag = <K extends keyof TDefinitions>(key: K, options?: EvaluationOptions) =>
    this.getFlagState(key, options).flag;

  /** Get flag state with source info */
  getFlagState<K extends keyof TDefinitions>(key: K, options?: EvaluationOptions): FlagState {
    return this.resolve(key, options);
  }

  /**
   * Resolve flag value with priority: URL > test > override > remote > fallback
   */
  resolve<K extends keyof TDefinitions>(key: K, options?: ResolveOptions): FlagState {
    const { gate, search, ...evaluationOptions } = options ?? {};
    const def = this.definitions[key];
    if (!def) return { flag: false, source: 'fallback' };

    const keyStr = key as string;

    // 1. URL has highest priority
    const urlOverrides = parseUrlOverrides(search);
    if (urlOverrides[keyStr] !== undefined) {
      return { flag: urlOverrides[keyStr], source: 'url' };
    }

    // 2. Test environment override
    if (isTestEnv() && def.testOverride !== undefined) {
      return { flag: def.testOverride, source: 'test' };
    }

    // 3. Static override
    if (def.override !== undefined) {
      return { flag: def.override, source: 'override' };
    }

    // 4. Remote value from Statsig
    try {
      const currentGate = gate ?? getStatsigClientSync().getFeatureGate(keyStr, evaluationOptions);
      return {
        flag: currentGate.value,
        source: currentGate.idType ? 'remote' : 'fallback',
      };
    } catch {
      return { flag: false, source: 'fallback' };
    }
  }
}

/**
 * Create a type-safe Flag Store with React hooks.
 *
 * @example
 * ```ts
 * const MY_FLAGS = {
 *   dark_mode: { description: 'Dark mode toggle' },
 *   new_checkout: { description: 'New checkout flow' },
 * } as const satisfies Record<string, FlagDefinition>;
 *
 * export const { flagStore, useFlag, useFlagState } = createFlagStore(MY_FLAGS);
 *
 * // Full type safety and autocomplete
 * const isDark = useFlag('dark_mode');  // ✓ autocomplete
 * useFlag('unknown');                    // ✗ compile error
 * ```
 */
export function createFlagStore<T extends Record<string, FlagDefinition>>(definitions: T) {
  const store = new FlagStore(definitions);

  type FlagKey = Extract<keyof T, string>;

  /**
   * React Hook: Get flag state with source info.
   */
  function useFlagState(key: FlagKey, options?: EvaluationOptions): FlagState {
    const featureGate = useFeatureGate(key, options);
    return store.resolve(key, { gate: featureGate, ...options });
  }

  /**
   * React Hook: Get flag boolean value.
   */
  function useFlag(key: FlagKey, options?: EvaluationOptions): boolean {
    const featureGate = useFeatureGate(key, options);
    return store.resolve(key, { gate: featureGate, ...options }).flag;
  }

  return {
    /** FlagStore instance */
    flagStore: store,
    /** React Hook: Get flag boolean value */
    useFlag,
    /** React Hook: Get flag state { flag, source } */
    useFlagState,
  };
}

// Re-export types
export type { FlagDefinition } from './types';

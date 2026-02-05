/**
 * Parameter Stores factory module.
 * Use createParamStore to create type-safe parameter stores and hooks.
 */

import { merge, set } from 'lodash';
import { useParameterStore } from '@statsig/react-bindings';
import z from 'zod';

import { getStatsigClientSync, isTestEnv } from './statsig';

/** Parameter definition */
export interface ParamDefinition<T = unknown> {
  schema: z.ZodType<T>;
  fallback: T;
  description?: string;
  testOverride?: T;
  override?: T;
}

/** Parameter store definition */
export interface ParamStoreDefinition<TParams extends Record<string, ParamDefinition<any>>> {
  description?: string;
  keep?: boolean;
  params: TParams;
}

/** Helper function to define a single param with type inference */
export function defineParam<T>(def: ParamDefinition<T>): ParamDefinition<T> {
  return def;
}

/** Try to coerce string value to the expected type based on schema */
function tryCoerce(raw: string, def: ParamDefinition | undefined): unknown {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // ignore
    }
  }
  if (def?.schema) {
    const num = Number(raw);
    if (!Number.isNaN(num) && def.schema.safeParse(num).success) {
      return num;
    }
    if (raw === 'true' && def.schema.safeParse(true).success) return true;
    if (raw === 'false' && def.schema.safeParse(false).success) return false;
    if (raw === 'null' && def.schema.safeParse(null).success) return null;
  }
  return raw;
}

const FP_PREFIX = 'fp.';
const hasWindow = typeof window !== 'undefined';

/** Single param state with value and source */
export interface ParamState<T> {
  value: T;
  source: 'url' | 'test' | 'override' | 'remote' | 'fallback';
  error?: z.ZodError;
  fallback?: T;
}

/** Store handle for accessing params */
export interface ParamStoreHandle<TParams extends Record<string, ParamDefinition<any>>> {
  get<P extends keyof TParams>(paramKey: P): z.infer<TParams[P]['schema']>;
  getState<P extends keyof TParams>(paramKey: P): ParamState<z.infer<TParams[P]['schema']>>;
}

/** Infer value types from param definitions */
export type ParamStoreValue<TParams extends Record<string, ParamDefinition<any>>> = {
  [K in keyof TParams]: z.infer<TParams[K]['schema']>;
};

/** Statsig ParameterStore return type */
type StatsigParameterStore = ReturnType<ReturnType<typeof getStatsigClientSync>['getParameterStore']>;

/** Resolve options for param lookup */
export interface ParamResolveOptions {
  statsigStore?: StatsigParameterStore | null;
  search?: string;
  disableExposureLog?: boolean;
}

/**
 * Type-safe ParamStore class.
 */
export class ParamStore<TStores extends Record<string, ParamStoreDefinition<any>>> {
  private readonly definitions: TStores;

  constructor(definitions: TStores) {
    this.definitions = definitions;
  }

  /**
   * Parse URL query string for param overrides.
   * Format: ?fp.store.param=value or ?fp.store={"param":"value"}
   */
  private parseUrlOverrides(search?: string): Record<string, Record<string, unknown>> {
    const searchString = search ?? (hasWindow ? window.location.search : '');
    const params = new URLSearchParams(searchString);
    const result: Record<string, Record<string, unknown>> = {};

    for (const [key, value] of params.entries()) {
      if (!key.startsWith(FP_PREFIX)) continue;
      const rest = key.slice(FP_PREFIX.length);
      const dotIndex = rest.indexOf('.');

      if (dotIndex >= 0) {
        const path = rest;
        const storeKey = rest.slice(0, dotIndex);
        const paramKey = rest.slice(dotIndex + 1);
        const storeDef = this.definitions[storeKey];
        const paramDef = storeDef?.params[paramKey];
        set(result, path, tryCoerce(value, paramDef));
      } else {
        const path = rest;
        try {
          const obj = JSON.parse(value);
          if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
            result[path] = merge(result[path] ?? {}, obj);
          }
        } catch {
          // ignore
        }
      }
    }
    return result;
  }

  /**
   * Resolve param value with priority: URL > test > override > remote > fallback
   */
  private resolve<K extends keyof TStores, P extends keyof TStores[K]['params']>(
    storeKey: K,
    paramKey: P,
    options?: ParamResolveOptions,
  ): ParamState<z.infer<TStores[K]['params'][P]['schema']>> {
    const { statsigStore, search, ...evaluationOptions } = options ?? {};
    const storeDef = this.definitions[storeKey];
    if (!storeDef) {
      throw new Error(`[ParamStore] Unknown store: ${String(storeKey)}`);
    }

    const def = storeDef.params[paramKey as string] as ParamDefinition;
    if (!def) {
      throw new Error(`[ParamStore] Unknown param: ${String(storeKey)}.${String(paramKey)}`);
    }

    const schema = def.schema;
    let value: unknown;
    let source: ParamState<unknown>['source'];

    // 1. URL has highest priority
    const urlOverrides = this.parseUrlOverrides(search);
    const urlVal = urlOverrides[storeKey as string]?.[paramKey as string];
    if (urlVal !== undefined) {
      value = urlVal;
      source = 'url';
    }
    // 2. Test environment override
    else if (isTestEnv() && def.testOverride !== undefined) {
      value = def.testOverride;
      source = 'test';
    }
    // 3. Static override
    else if (def.override !== undefined) {
      value = def.override;
      source = 'override';
    }
    // 4. Remote value from Statsig
    else {
      const clientStore = statsigStore ?? getStatsigClientSync().getParameterStore(storeKey as string, evaluationOptions);
      const config = (clientStore as any)?.__configuration?.[paramKey as string];
      if (config !== undefined) {
        value = clientStore.get(paramKey as string, def.fallback);
        source = 'remote';
      } else {
        value = def.fallback;
        source = 'fallback';
      }
    }

    // Schema validation
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      console.error(`[ParamStore] Schema mismatch (${source}): ${String(storeKey)}.${String(paramKey)}`, value, parsed.error);
      const fallbackVal = def.fallback;
      if (source === 'remote') {
        return { value: fallbackVal, source: 'fallback', error: parsed.error };
      }
      return { value: value as any, source, error: parsed.error, fallback: fallbackVal };
    }
    return { value: parsed.data, source };
  }

  /** Get param state with value and source info */
  getParamState<K extends keyof TStores, P extends keyof TStores[K]['params']>(
    storeKey: K,
    paramKey: P,
    options?: ParamResolveOptions,
  ): ParamState<z.infer<TStores[K]['params'][P]['schema']>> {
    return this.resolve(storeKey, paramKey, options);
  }

  /** Get param value directly */
  getParam<K extends keyof TStores, P extends keyof TStores[K]['params']>(
    storeKey: K,
    paramKey: P,
    options?: ParamResolveOptions,
  ): z.infer<TStores[K]['params'][P]['schema']> {
    return this.resolve(storeKey, paramKey, options).value;
  }

  /** Get store handle for multiple param access */
  getStore<K extends keyof TStores>(
    storeKey: K,
    options?: ParamResolveOptions,
  ): ParamStoreHandle<TStores[K]['params']> {
    const { statsigStore, ...rest } = options ?? {};
    let cachedStore: StatsigParameterStore | null | undefined = statsigStore;
    if (cachedStore === undefined) {
      try {
        cachedStore = getStatsigClientSync().getParameterStore(storeKey as string, rest);
      } catch {
        cachedStore = null;
      }
    }
    const opts: ParamResolveOptions = { ...rest, statsigStore: cachedStore };
    return {
      get: <P extends keyof TStores[K]['params']>(paramKey: P) => this.resolve(storeKey, paramKey, opts).value,
      getState: <P extends keyof TStores[K]['params']>(paramKey: P) => this.resolve(storeKey, paramKey, opts),
    };
  }
}

/**
 * Create a type-safe Param Store with React hooks.
 *
 * @example
 * ```ts
 * const MY_PARAMS = {
 *   homepage_cta: {
 *     description: 'Homepage CTA button',
 *     params: {
 *       text: defineParam({ schema: z.string(), fallback: 'Learn More' }),
 *       color: defineParam({ schema: z.enum(['red', 'blue']), fallback: 'blue' }),
 *     },
 *   },
 * } as const satisfies Record<string, ParamStoreDefinition<any>>;
 *
 * export const { paramStore, useParam, useParamState } = createParamStore(MY_PARAMS);
 *
 * // Full type safety and autocomplete
 * const text = useParam('homepage_cta', 'text');   // string type
 * const color = useParam('homepage_cta', 'color'); // 'red' | 'blue' type
 * ```
 */
export function createParamStore<T extends Record<string, ParamStoreDefinition<any>>>(definitions: T) {
  const store = new ParamStore(definitions);

  type StoreKey = Extract<keyof T, string>;

  /**
   * React Hook: Get store handle for multiple param access.
   */
  function useParamStore<K extends StoreKey>(
    storeKey: K,
    options?: ParamResolveOptions,
  ): ParamStoreHandle<T[K]['params']> {
    const statsigStore = useParameterStore(storeKey, options);
    return store.getStore(storeKey, { ...options, statsigStore });
  }

  /**
   * React Hook: Get single param state.
   */
  function useParamState<K extends StoreKey, P extends keyof T[K]['params']>(
    storeKey: K,
    paramKey: P,
    options?: ParamResolveOptions,
  ): ParamState<z.infer<T[K]['params'][P]['schema']>> {
    const statsigStore = useParameterStore(storeKey, options);
    return store.getParamState(storeKey, paramKey, { ...options, statsigStore });
  }

  /**
   * React Hook: Get single param value.
   */
  function useParam<K extends StoreKey, P extends keyof T[K]['params']>(
    storeKey: K,
    paramKey: P,
    options?: ParamResolveOptions,
  ): z.infer<T[K]['params'][P]['schema']> {
    return useParamState(storeKey, paramKey, options).value;
  }

  return {
    /** ParamStore instance */
    paramStore: store,
    /** React Hook: Get single param value */
    useParam,
    /** React Hook: Get single param state */
    useParamState,
    /** React Hook: Get store handle */
    useParamStore,
  };
}

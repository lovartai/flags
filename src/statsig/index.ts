/**
 * @lovart-open/flags/statsig
 *
 * Type-safe Feature Flag and Parameter Store management library.
 *
 * Feature flag priority: URL > testOverride > override > remote > fallback(false)
 * Parameter Store priority: URL > testOverride > override > remote > fallback
 */

// Flag factory and types
export { createFlagStore, FlagStore, parseUrlOverrides, type ResolveOptions } from './flags';

// Param factory and types
export {
  createParamStore,
  defineParam,
  PARAM_SCHEMA_MISMATCH_EVENT,
  type ParamSchemaMismatchDetail,
  parseParamStoreUrlOverrides,
  ParamStore,
  type ParamDefinition,
  type ParamResolveOptions,
  type ParamState,
  type ParamStoreDefinition,
  type ParamStoreHandle,
  type ParamStoreValue,
} from './params';

// Logger
export { getLogger, setLogger, type Logger } from './logger';

// Statsig client
export {
  getStatsigClientSync,
  initStatsigClient,
  isTestEnv,
  type InitOptions,
  type StatsigBootstrap,
} from './client';

// Core types
export {
  type EvaluationOptions,
  type FeatureGate,
  type FlagDefinition,
  type FlagKeyOf,
  type FlagPriority,
  type FlagSnapshot,
  type FlagState,
  type RemoteFlagValues,
} from './types';

// Statsig React bindings (re-export)
export * from '@statsig/react-bindings';

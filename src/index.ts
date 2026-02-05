/**
 * statsig
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
  ParamStore,
  type ParamDefinition,
  type ParamResolveOptions,
  type ParamState,
  type ParamStoreDefinition,
  type ParamStoreHandle,
  type ParamStoreValue,
} from './params';

// Logger
export { getLogger, type Logger } from './logger';

// Statsig integration
export { getStatsigClientSync, initStatsigClient, isTestEnv, type InitOptions } from './statsig';

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

/**
 * Core types for the feature flag and parameter store.
 */

/**
 * Statsig Feature Gate type (internal use).
 */
export interface FeatureGate {
  value: boolean;
  idType?: string | null;
  details?: { reason: string };
}

/**
 * Statsig evaluation options.
 */
export interface EvaluationOptions {
  /** Disable exposure logging */
  disableExposureLog?: boolean;
}

/**
 * Feature flag definition.
 */
export interface FlagDefinition {
  /** Human-readable description */
  description?: string;
  /** Fixed value for test/E2E environments */
  testOverride?: boolean;
  /** Static override value (higher priority than remote) */
  override?: boolean;
  /** Mark as kept locally (no remote config needed) */
  keep?: boolean;
}

/**
 * Flag value source priority levels.
 */
export type FlagPriority = 'url' | 'test' | 'override' | 'remote' | 'fallback';

/**
 * Flag state with value and source information.
 */
export interface FlagState {
  flag: boolean;
  source: FlagPriority;
}

/**
 * Extract string keys from flag definitions.
 */
export type FlagKeyOf<TDefinitions extends Record<string, FlagDefinition>> = Extract<keyof TDefinitions, string>;

/**
 * Snapshot of all flag states keyed by flag key.
 */
export type FlagSnapshot<TKey extends string = string> = Record<TKey, FlagState>;

/**
 * Remote flag values (boolean map).
 */
export type RemoteFlagValues<TKey extends string = string> = Partial<Record<TKey, boolean>>;

// Mock external dependencies
const mockGetFeatureGate = vi.fn();
const mockIsTestEnv = vi.fn(() => false);
vi.mock('../statsig', () => ({
  getStatsigClientSync: vi.fn(() => ({
    getFeatureGate: mockGetFeatureGate,
  })),
  isTestEnv: () => mockIsTestEnv(),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFlagStore, type FlagDefinition } from '../flags';

describe('FlagStore', () => {
  const mockFlags = {
    feature_a: { description: 'Feature A' },
    feature_b: { description: 'Feature B', testOverride: true },
    feature_c: { description: 'Feature C', override: false },
  } as const satisfies Record<string, FlagDefinition>;

  const { flagStore } = createFlagStore(mockFlags);

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetFeatureGate.mockReturnValue({
      value: false,
      idType: '',
    });
    mockIsTestEnv.mockReturnValue(false);
    vi.stubGlobal('location', {
      search: '',
      pathname: '/',
      hash: '',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Initial State', () => {
    it('should initialize with fallback state', () => {
      const state = flagStore.getFlagState('feature_a');
      expect(state.flag).toBe(false);
      expect(state.source).toBe('fallback');
    });
  });

  describe('Priority Logic', () => {
    it('Priority 1: URL Override should win', () => {
      vi.stubGlobal('location', {
        search: '?ff.feature_a=1',
        href: 'http://localhost/?ff.feature_a=1',
      });
      const urlState = flagStore.resolve('feature_a', { search: '?ff.feature_a=1' });
      expect(urlState.flag).toBe(true);
      expect(urlState.source).toBe('url');
    });

    it('Priority 2: Test Override should win over code static override', () => {
      mockIsTestEnv.mockReturnValue(true);
      const state = flagStore.getFlagState('feature_b');
      expect(state.flag).toBe(true);
      expect(state.source).toBe('test');
    });

    it('Priority 3: Code Static Override should win over remote', () => {
      mockGetFeatureGate.mockReturnValue({ value: true, idType: 'userID' });
      const state = flagStore.getFlagState('feature_c');
      expect(state.flag).toBe(false);
      expect(state.source).toBe('override');
    });

    it('Priority 4: Remote Value should win over fallback', () => {
      mockGetFeatureGate.mockReturnValue({ value: true, idType: 'userID' });
      const state = flagStore.getFlagState('feature_a');
      expect(state.source).toBe('remote');
      expect(state.flag).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should have type-safe keys', () => {
      // These calls should have type hints
      flagStore.getFlag('feature_a');
      flagStore.getFlag('feature_b');
      flagStore.getFlag('feature_c');

      // Uncommenting below should cause compile error
      // flagStore.getFlag('unknown_key');
    });
  });

  describe('Edge Cases', () => {
    it('should support explicit remoteValue passed to resolve', () => {
      const state = flagStore.resolve('feature_a', { gate: { value: true, idType: 'useID' } as any });
      expect(state.flag).toBe(true);
      expect(state.source).toBe('remote');
    });
  });
});

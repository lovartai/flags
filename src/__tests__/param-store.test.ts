import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Mock statsig
const mockIsTestEnv = vi.fn(() => false);
vi.mock('../statsig/client', () => ({
  getStatsigClientSync: vi.fn(() => ({
    getParameterStore: vi.fn(),
  })),
  isTestEnv: () => mockIsTestEnv(),
}));

import { createParamStore, defineParam, type ParamStoreDefinition, getStatsigClientSync } from '../statsig';

describe('ParamStore', () => {
  const testStores = {
    test_store: {
      description: 'Test store',
      params: {
        text: defineParam({ schema: z.string(), fallback: 'default text' }),
        count: defineParam({ schema: z.number(), fallback: 0 }),
        enabled: defineParam({ schema: z.boolean(), fallback: false }),
        color: defineParam({
          schema: z.enum(['red', 'blue', 'green']),
          fallback: 'red' as const,
          testOverride: 'blue' as const,
        }),
        size: defineParam({
          schema: z.number(),
          fallback: 10,
          override: 20,
        }),
      },
    },
  } as const satisfies Record<string, ParamStoreDefinition<any>>;

  const { paramStore } = createParamStore(testStores);

  beforeEach(() => {
    vi.resetAllMocks();
    mockIsTestEnv.mockReturnValue(false);
    vi.stubGlobal('location', { search: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getParam / getParamState', () => {
    it('returns fallback value when remote has no config', () => {
      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: vi.fn(() => ({
          get: (_key: string, fallback: unknown) => fallback,
        })),
      } as any);

      const value = paramStore.getParam('test_store', 'text');
      expect(value).toBe('default text');

      const state = paramStore.getParamState('test_store', 'text');
      expect(state.value).toBe('default text');
      expect(state.source).toBe('fallback');
    });

    it('returns remote value when remote has data', () => {
      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: vi.fn(() => ({
          __configuration: {
            text: { value: 'remote text' },
          },
          get: (key: string) => (key === 'text' ? 'remote text' : undefined),
        })),
      } as any);

      const state = paramStore.getParamState('test_store', 'text');
      expect(state.value).toBe('remote text');
      expect(state.source).toBe('remote');
    });

    it('URL override has highest priority', () => {
      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: vi.fn(() => ({
          __configuration: { text: { value: 'remote text' } },
          get: () => 'remote text',
        })),
      } as any);

      const state = paramStore.getParamState('test_store', 'text', {
        search: '?fp.test_store.text=URL text',
      });
      expect(state.value).toBe('URL text');
      expect(state.source).toBe('url');
    });

    it('testOverride works in E2E environment', () => {
      mockIsTestEnv.mockReturnValue(true);

      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: vi.fn(() => ({
          get: () => 'green',
        })),
      } as any);

      const state = paramStore.getParamState('test_store', 'color');
      expect(state.value).toBe('blue');
      expect(state.source).toBe('test');
    });

    it('override has priority over remote', () => {
      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: vi.fn(() => ({
          get: () => 30,
        })),
      } as any);

      const state = paramStore.getParamState('test_store', 'size');
      expect(state.value).toBe(20);
      expect(state.source).toBe('override');
    });

    it('URL number type coercion', () => {
      const state = paramStore.getParamState('test_store', 'count', {
        search: '?fp.test_store.count=42',
      });
      expect(state.value).toBe(42);
      expect(state.source).toBe('url');
    });

    it('URL boolean type coercion', () => {
      const state = paramStore.getParamState('test_store', 'enabled', {
        search: '?fp.test_store.enabled=true',
      });
      expect(state.value).toBe(true);
      expect(state.source).toBe('url');
    });
  });

  describe('getStore', () => {
    it('returns handle object with { get, getState }', () => {
      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: vi.fn(() => ({
          get: (_key: string, fallback: unknown) => fallback,
        })),
      } as any);

      const store = paramStore.getStore('test_store');

      expect(typeof store.get).toBe('function');
      expect(typeof store.getState).toBe('function');

      expect(store.get('text')).toBe('default text');
      expect(store.getState('count')).toEqual({ value: 0, source: 'fallback' });
    });

    it('handle reuses same statsigStore', () => {
      const mockGetParameterStore = vi.fn(() => ({
        get: (_key: string, fallback: unknown) => fallback,
      }));
      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: mockGetParameterStore,
      } as any);

      const store = paramStore.getStore('test_store');
      store.get('text');
      store.get('count');
      store.getState('enabled');

      // getParameterStore should only be called once (closure reuse)
      expect(mockGetParameterStore).toHaveBeenCalledTimes(1);
    });
  });

  describe('Priority Order', () => {
    it('URL > test > override > remote > fallback', () => {
      mockIsTestEnv.mockReturnValue(true);

      vi.mocked(getStatsigClientSync).mockReturnValue({
        getParameterStore: vi.fn(() => ({
          get: () => 'green',
        })),
      } as any);

      // color has testOverride='blue', remote='green'
      // URL override should take priority
      const state = paramStore.getParamState('test_store', 'color', {
        search: '?fp.test_store.color=red',
      });
      expect(state.value).toBe('red');
      expect(state.source).toBe('url');
    });
  });

  describe('Error Handling', () => {
    it('throws error for unknown store', () => {
      expect(() => {
        (paramStore as any).getParamState('unknown_store', 'text');
      }).toThrow('[ParamStore] Unknown store: unknown_store');
    });

    it('throws error for unknown param', () => {
      expect(() => {
        (paramStore as any).getParamState('test_store', 'unknown_param');
      }).toThrow('[ParamStore] Unknown param: test_store.unknown_param');
    });

    it('logs warning when URL value schema mismatch', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // count expects number, passing non-numeric string 'abc'
      paramStore.getParamState('test_store', 'count', {
        search: '?fp.test_store.count=abc',
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Schema mismatch'), 'abc', expect.anything());

      consoleSpy.mockRestore();
    });
  });

  describe('Type Safety', () => {
    it('should have type-safe store and param keys', () => {
      // These calls should have type hints
      paramStore.getParam('test_store', 'text'); // string
      paramStore.getParam('test_store', 'count'); // number
      paramStore.getParam('test_store', 'enabled'); // boolean
      paramStore.getParam('test_store', 'color'); // 'red' | 'blue' | 'green'

      // Uncommenting below should cause compile error
      // paramStore.getParam('unknown_store', 'text');
      // paramStore.getParam('test_store', 'unknown_param');
    });
  });
});

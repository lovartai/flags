# statsig

[![CI](https://github.com/lovartai/flags/actions/workflows/ci.yml/badge.svg)](https://github.com/lovartai/flags/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/statsig.svg)](https://www.npmjs.com/package/statsig)

Type-safe Feature Flag and Parameter Store library built on Statsig, with a fully synchronous architecture.

## Installation

```bash
npm install statsig
# or
pnpm add statsig
```

## Initialize Statsig

Initialize the Statsig client at your app entry point:

```ts
import { initStatsigClient } from 'statsig';

initStatsigClient('your-statsig-client-key', { userID: 'user-123' }, {
  environment: { tier: 'production' },
});
```

---

# Feature Flags

## Core Features

- **Type-safe**: Full TypeScript type inference and autocomplete
- **Synchronous**: No loading states, no skeleton screens
- **Multi-layer priority**: `URL > testOverride > override > remote > fallback(false)`

## Define and Create

```ts
import { createFlagStore, type FlagDefinition } from 'statsig';

// 1. Define your flags
const MY_FLAGS = {
  dark_mode: { 
    description: 'Dark mode toggle' 
  },
  new_checkout: { 
    description: 'New checkout flow',
    testOverride: true,  // Force enable in E2E tests
  },
  beta_feature: {
    description: 'Beta feature',
    override: false,     // Static override, ignores remote
  },
} as const satisfies Record<string, FlagDefinition>;

// 2. Create type-safe store and hooks
export const { 
  flagStore, 
  useFlag, 
  useFlagState 
} = createFlagStore(MY_FLAGS);

// 3. Export types (optional)
export type MyFlagKey = keyof typeof MY_FLAGS;
```

## React Usage

```tsx
import { useFlag, useFlagState } from './my-flags';

function App() {
  // Get boolean value directly
  const isDark = useFlag('dark_mode');  // ✓ autocomplete
  
  // Get full state with source info
  const state = useFlagState('new_checkout');
  console.log(state.flag, state.source);  // true, 'remote'
  
  return isDark ? <DarkTheme /> : <LightTheme />;
}
```

## Non-React Usage

```ts
import { flagStore } from './my-flags';

// Get single flag
const enabled = flagStore.getFlag('dark_mode');

// Get snapshot of all flags
const snapshot = flagStore.snapshot;
```

## URL Override for Debugging

```
?ff.dark_mode=1    → Force enable
?ff.dark_mode=0    → Force disable
```

---

# Parameter Store

## Core Features

- **Type-safe**: Zod schema validation + TypeScript inference
- **Synchronous**: Same as Feature Flags
- **Multi-layer priority**: `URL > testOverride > override > remote > fallback`

## Define and Create

```ts
import { z } from 'zod';
import { 
  createParamStore, 
  defineParam, 
  type ParamStoreDefinition 
} from 'statsig';

// 1. Define your param stores
const MY_PARAMS = {
  homepage_cta: {
    description: 'Homepage CTA button',
    params: {
      text: defineParam({
        schema: z.enum(['Learn More', 'Get Started', 'Sign Up']),
        fallback: 'Learn More',
        description: 'Button text',
      }),
      color: defineParam({
        schema: z.enum(['gray', 'red', 'blue']),
        fallback: 'gray',
        testOverride: 'blue',  // Use in E2E tests
      }),
      visible: defineParam({
        schema: z.boolean(),
        fallback: true,
      }),
    },
  },
  pricing: {
    description: 'Pricing config',
    params: {
      discount: defineParam({
        schema: z.number().min(0).max(100),
        fallback: 0,
      }),
      currency: defineParam({
        schema: z.enum(['USD', 'CNY', 'EUR']),
        fallback: 'USD',
      }),
    },
  },
} as const satisfies Record<string, ParamStoreDefinition<any>>;

// 2. Create type-safe store and hooks
export const { 
  paramStore, 
  useParam, 
  useParamState, 
  useParamStore 
} = createParamStore(MY_PARAMS);
```

## React Usage

```tsx
import { useParam, useParamStore } from './my-params';

function CTAButton() {
  // Get value directly (with full type hints)
  const text = useParam('homepage_cta', 'text');   // 'Learn More' | 'Get Started' | 'Sign Up'
  const color = useParam('homepage_cta', 'color'); // 'gray' | 'red' | 'blue'

  // Or get entire store handle
  const store = useParamStore('homepage_cta');
  const visible = store.get('visible');  // boolean

  if (!visible) return null;
  return <button style={{ color }}>{text}</button>;
}
```

## Non-React Usage

```ts
import { paramStore } from './my-params';

// Get single param
const discount = paramStore.getParam('pricing', 'discount');  // number

// Get store handle
const store = paramStore.getStore('pricing');
store.get('currency');  // 'USD' | 'CNY' | 'EUR'
```

## URL Override for Debugging

```
# Single param override
?fp.homepage_cta.text=Get Started
?fp.pricing.discount=20

# Entire store JSON override
?fp.homepage_cta={"text":"Get Started","visible":false}
```

---

# Advanced Configuration

## Custom Logger

```ts
initStatsigClient('client-xxx', { userID: 'user-123' }, {
  logger: (message, data) => myLogger.info(message, data),
});
```

## E2E Test Support

Configure `isTestEnv` in initialization to enable `testOverride` values:

```ts
initStatsigClient('client-xxx', { userID: 'user-123' }, {
  isTestEnv: () => Boolean(window.__E2E__),
});

// playwright/cypress tests
await page.addInitScript(() => {
  window.__E2E__ = true;
});
```

## FlagDefinition Options

| Property | Type | Description |
|----------|------|-------------|
| `description` | `string` | Human-readable description |
| `testOverride` | `boolean` | Fixed value in E2E tests |
| `override` | `boolean` | Static override (priority over remote) |
| `keep` | `boolean` | Mark as kept locally (no remote needed) |

## ParamDefinition Options

| Property | Type | Description |
|----------|------|-------------|
| `schema` | `z.ZodType` | Zod schema (required) |
| `fallback` | `T` | Default value (required) |
| `description` | `string` | Human-readable description |
| `testOverride` | `T` | Fixed value in E2E tests |
| `override` | `T` | Static override |

---

## License

MIT

import { defineConfig } from 'tsup';

export default defineConfig([
  // 主入口
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
  },
  // statsig 子模块
  {
    entry: { 'statsig/index': 'src/statsig/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    // 不打包依赖，保持代码分离
    noExternal: [/^\.\.?\//],
    bundle: true,
  },
]);

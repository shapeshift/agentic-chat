import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    index: 'src/index.ts',
    // Loaded at runtime by tools/mathCalculator.ts via new Worker()
    mathCalculatorWorker: 'src/tools/mathCalculatorWorker.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  dts: {
    resolve: true,
    entry: ['src/index.ts'],
    compilerOptions: {
      composite: false,
      skipLibCheck: true,
    },
  },
  minify: false,
  bundle: true,
  splitting: false,
  treeshake: true,
  external: ['bun'],
})

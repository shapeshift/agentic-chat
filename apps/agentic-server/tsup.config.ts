import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts', 'src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  minify: false,
  bundle: true,
  splitting: false,
  treeshake: true,
  external: ['@shapeshiftoss/caip', '@shapeshiftoss/types', '@shapeshiftoss/utils'],
})

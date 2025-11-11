import { defineConfig } from 'tsup';
export default defineConfig({
    entry: ['src/server.ts', 'src/index.ts'],
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
    external: [],
});

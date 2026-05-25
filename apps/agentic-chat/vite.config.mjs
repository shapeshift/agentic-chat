import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig(() => ({
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
        include: ['three'],
    },
    envDir: resolve(__dirname, '../..'),
    cacheDir: resolve(__dirname, '../../node_modules/.vite/agentic-chat'),
    define: {
        global: 'globalThis',
        'process.env': '{}',
    },
    server: {
        port: 4200,
        host: 'localhost',
    },
    preview: {
        port: 4300,
        host: 'localhost',
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            buffer: 'buffer/',
        },
    },
    build: {
        outDir: './dist',
        emptyOutDir: true,
        reportCompressedSize: true,
        sourcemap: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
}));

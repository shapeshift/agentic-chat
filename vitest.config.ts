import { resolve } from 'path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    poolOptions: {
      threads: { singleThread: true },
      forks: { isolate: false },
    },
    exclude: ['**/dist/**', '**/node_modules/**'],
    projects: [
      {
        resolve: {
          alias: {
            '@': resolve(__dirname, 'apps/agentic-chat/src'),
          },
        },
        test: {
          globals: true,
          clearMocks: true,
          name: 'agentic-chat',
          environment: 'happy-dom',
          include: ['apps/agentic-chat/src/**/*.{test,spec}.{js,ts,tsx}'],
        },
      },
      {
        test: {
          globals: true,
          clearMocks: true,
          name: 'packages',
          environment: 'node',
          include: ['packages/*/src/**/*.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
})

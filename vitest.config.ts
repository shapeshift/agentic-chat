import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    poolOptions: {
      threads: { singleThread: true },
      forks: { isolate: false },
    },
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/agentic-chat-e2e/**'],
    projects: [
      {
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

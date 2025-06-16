import { defineConfig } from 'vitest/config'

export default defineConfig(() => {
  return {
    test: {
      globals: true,
      environment: 'happy-dom',
      clearMocks: true,
      poolOptions: {
        threads: {
          singleThread: true,
        },
        forks: {
          isolate: false,
        },
      },
      exclude: ['node_modules', 'apps/agentic-chat-e2e/**'],
    },
  }
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['plugins/*/src/**/*.test.ts', 'tests/**/*.test.mjs'],
  },
})

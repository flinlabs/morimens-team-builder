import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Several suites do real search work — the D-Tide five-board solve and the
    // pull-advice beam over the whole roster both run for seconds on purpose.
    // Vitest's 5s default was tripping them intermittently under parallel load,
    // which showed up as a different test "failing" on each run. Raised rather
    // than worked around, because the assertions themselves are sound.
    testTimeout: 30_000,
  },
})

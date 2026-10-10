import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig({} as any), defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      // Node's built-in test suites are run explicitly via node --test.
      '**/scripts/*.test.mjs',
      '**/e2e/**',
      '**/tests/e2e/**',
      '**/rules-diagnose.spec.ts',
      '**/rules-sprache.spec.ts',
      '**/tests/enterprise/**',
      ...(process.env.FIRESTORE_EMULATOR_HOST ? [] : ['**/rules.spec.ts', '**/chatPersistence.spec.ts']),
      ...(process.env.FIREBASE_AUTH_EMULATOR_HOST ? [] : ['**/verificationSecurity.spec.ts']),
      ...(process.env.FIREBASE_STORAGE_EMULATOR_HOST ? [] : ['**/storageRules.spec.ts', '**/accountErasure.spec.ts']),
    ],
    globals: true,
    // Rule suites reset a shared emulator database. Do not race with persistence tests.
    fileParallelism: false,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
}))

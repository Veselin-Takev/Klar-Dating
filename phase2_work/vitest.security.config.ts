import { defineConfig } from 'vitest/config';

// Explicit deterministic subset of the legacy enterprise folder. No providers,
// credentials, emulator connections or stochastic model evaluation are required.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/enterprise/securityGuardrails.spec.ts'],
    fileParallelism: false,
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one real Postgres instance (seeded data,
    // token revocation, etc.) — running test files in parallel causes
    // cross-file races on that shared state, so keep them sequential.
    fileParallelism: false,
  },
});

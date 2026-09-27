import { defineConfig } from 'vitest/config';

// Merged into the @angular/build:unit-test runner config. Test files run in parallel workers that all
// transform the lazily imported icon set on first render, so the 5 s default is too tight on slower
// machines.
export default defineConfig({
  test: {
    testTimeout: 15_000,
  },
});

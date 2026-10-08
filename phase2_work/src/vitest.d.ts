import 'vitest';

declare module 'vitest' {
  interface Matchers<R, T> {
    toHaveNoViolations: () => R;
  }
}

/** CSP runtime policy: application mode must never be overridden by client build flags. */
export type CspRuntimeEnvironment = Readonly<Record<string, string | undefined>>;

/** Production and recognizable Cloud runtimes must always enforce CSP. */
export function shouldEnforceContentSecurityPolicy(env: CspRuntimeEnvironment): boolean {
  return env.NODE_ENV === 'production'
    || env.KLAR_RUNTIME_ENV === 'production'
    || !!env.K_SERVICE
    || !!env.GAE_ENV
    || !!env.FUNCTION_TARGET
    || !!env.FUNCTION_NAME;
}

/**
 * Local smoke tests build and run with NODE_ENV=production to exercise the
 * production bundle. They alone may add locally scoped emulator origins.
 * Real cloud runtimes cannot obtain this exception through an accidental
 * KLAR_ALLOW_LOCAL_EMULATOR_CSP or VITE_EMULATOR deployment flag.
 */
export function shouldPermitEmulatorCspSources(env: CspRuntimeEnvironment): boolean {
  if (!shouldEnforceContentSecurityPolicy(env)) return true;
  // Production-built local smoke tests are the only allowed exception.
  if (env.NODE_ENV !== 'production') return false;
  return env.KLAR_RUNTIME_ENV === 'local'
    && env.KLAR_ALLOW_LOCAL_EMULATOR_CSP === 'true'
    && !env.K_SERVICE
    && !env.GAE_ENV
    && !env.FUNCTION_TARGET
    && !env.FUNCTION_NAME;
}

/** Typed entrypoint for the read-only, anonymous deployed Vercel API smoke. */
export declare function probeVercelApi(
  base: string,
  send?: typeof fetch,
): Promise<{ ok: true; endpoints: string[] }>;

import { z } from 'zod';
import { tenantIdSchema } from './tenantAuth';

const applicationConfigSchema = z.strictObject({
  interface: z.strictObject({
    locale: z.enum(['de', 'en', 'es', 'fr']),
    reducedMotion: z.boolean(),
  }),
  discovery: z.strictObject({ dailySuggestions: z.number().int().min(1).max(12) }),
  privacy: z.strictObject({ requireVerifiedProfile: z.literal(true) }),
});
export type TenantApplicationConfig = z.infer<typeof applicationConfigSchema>;
const defaults: TenantApplicationConfig = Object.freeze({
  interface: Object.freeze({ locale: 'de', reducedMotion: false }),
  discovery: Object.freeze({ dailySuggestions: 8 }),
  privacy: Object.freeze({ requireVerifiedProfile: true }),
});
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Pure, bounded merge: no mutation, no inherited keys, no unsafe prototypes. */
export function safeDeepMerge(left: unknown, right: unknown, depth = 0): unknown {
  if (depth > 10) throw new Error('config_depth_exceeded');
  if (!plain(left) || !plain(right)) throw new Error('config_layer_invalid');
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(left)) {
    if (forbidden.has(key)) throw new Error('config_forbidden_key');
    result[key] = value;
  }
  for (const [key, value] of Object.entries(right)) {
    if (forbidden.has(key)) throw new Error('config_forbidden_key');
    if (plain(value)) result[key] = safeDeepMerge(plain(result[key]) ? result[key] : {}, value, depth + 1);
    else if (Array.isArray(value) || value === null || typeof value === 'object') throw new Error('config_value_invalid');
    else result[key] = value;
  }
  return result;
}
export interface ConfigLayers {
  region?: unknown;
  tenant?: unknown;
  subTenant?: unknown;
  subTenantId?: string;
}
export function resolveTenantConfig(layers: ConfigLayers): TenantApplicationConfig {
  if (layers.subTenantId !== undefined) tenantIdSchema.parse(layers.subTenantId);
  else if (layers.subTenant !== undefined) throw new Error('subtenant_identity_required');
  let merged: unknown = defaults;
  // Every layer must validate independently after composition, not only the
  // final result (which could conceal a previously invalid setting).
  for (const layer of [layers.region, layers.tenant, layers.subTenant]) {
    if (layer === undefined) continue;
    merged = applicationConfigSchema.parse(safeDeepMerge(merged, layer));
  }
  return applicationConfigSchema.parse(merged);
}

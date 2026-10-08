/** Generic runtime JSON-shaped object used at untrusted persistence boundaries. */
export type JsonObject = Record<string, unknown>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

/** Narrow an unknown value to a dictionary without asserting a business schema. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

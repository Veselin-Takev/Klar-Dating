/** Source catalog only: recognizes repository arguments without claiming erasure. */
export function tenantCollectionNames(source) {
  const literals = new Map();
  for (const hit of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([`'"])(.*?)\2/g)) {
    const entries = literals.get(hit[1]) ?? [];
    entries.push(hit[3]); literals.set(hit[1], entries);
  }
  const names = new Set();
  function resolve(value, depth = 0) {
    if (depth > 4) return;
    const direct = value.match(/^([a-z_]+)(?:\/|$)/);
    if (direct) { names.add(direct[1]); return; }
    const interpolation = value.match(/^\$\{([A-Z_][A-Z0-9_]*)\}\//);
    if (interpolation) for (const literal of literals.get(interpolation[1]) ?? []) resolve(literal, depth + 1);
  }
  // Restrict inference to actual closed repository method arguments. Unused
  // collection constants must not conceal the removal of a real writer.
  for (const call of source.matchAll(/\b(?:repo|repository|db|tx|firestore)\.(?:read|write|create|delete|list)\(\s*(?:([`'"])(.*?)\1|([A-Za-z_$][\w$]*))/g)) {
    if (call[2] !== undefined) resolve(call[2]);
    else for (const literal of literals.get(call[3]) ?? []) resolve(literal);
  }
  return names;
}

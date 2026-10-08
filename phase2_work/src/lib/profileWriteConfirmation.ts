export function omitUndefinedFields<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function valueEquals(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;

  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && expected.every((value, index) => valueEquals(actual[index], value));
  }

  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    const expectedRecord = expected as Record<string, unknown>;
    const actualRecord = actual as Record<string, unknown>;
    const expectedKeys = Object.keys(expectedRecord);
    const actualKeys = Object.keys(actualRecord);
    return actualKeys.length === expectedKeys.length
      && expectedKeys.every(key =>
        Object.prototype.hasOwnProperty.call(actualRecord, key)
        && valueEquals(actualRecord[key], expectedRecord[key]),
      );
  }

  return false;
}

export function profileContainsExpectedFields(
  profile: Record<string, unknown>,
  expectedFields: Record<string, unknown>,
): boolean {
  return Object.entries(expectedFields).every(([key, expected]) =>
    Object.prototype.hasOwnProperty.call(profile, key)
    && valueEquals(profile[key], expected),
  );
}

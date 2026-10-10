export function assertExpectedReleaseSha(actual, expected) {
  if (typeof expected !== 'string' || !/^[0-9a-f]{40}$/.test(expected)) {
    throw new Error('KLAR_EXPECTED_SHA must be an explicit lowercase 40-character Git commit SHA.');
  }
  if (actual !== expected) throw new Error('Local checkout does not match KLAR_EXPECTED_SHA.');
}

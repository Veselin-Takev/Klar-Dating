export const APPROVED_ATTEST_ACTION_SHA = 'badbb428b0055a04f53d6ce00bda98cf1c04e56e';

export function validateAttestActionPin(workflowText) {
  const pins = String(workflowText).split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^uses:\s*actions\/attest@/.test(line));
  return pins.length === 1 && pins[0] === 'uses: actions/attest@' + APPROVED_ATTEST_ACTION_SHA;
}

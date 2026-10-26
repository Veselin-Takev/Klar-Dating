import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAdoptionEvidenceFailures } from './adoption-evidence.mjs';

// Canonical register only: no environment/path override or network access.
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/phase3');
try {
  if (lstatSync(resolve(directory, 'EVIDENCE_REGISTER.json')).isSymbolicLink()) throw new Error('NONCANONICAL_REGISTER');
  const data = JSON.parse(readFileSync(resolve(directory, 'EVIDENCE_REGISTER.json'), 'utf8'));
  const failures = collectAdoptionEvidenceFailures(data);
  for (const file of ['ADOPTION_PLAYBOOK.md', 'ENABLEMENT_AND_TEMPLATES.md', 'SCORECARD_AND_ACCEPTANCE.md']) {
    if (lstatSync(resolve(directory, file)).isSymbolicLink()) throw new Error('NONCANONICAL_ARTIFACT');
    const path = realpathSync(resolve(directory, file));
    if (!path.startsWith(realpathSync(directory) + sep) || !readFileSync(path, 'utf8').trim()) failures.push('ARTIFACT_MISSING_OR_OUTSIDE_SCOPE');
  }
  if (failures.length) {
    console.error('Adoption evidence consistency: FAIL (' + failures.join(', ') + ')');
    process.exitCode = 1;
  } else {
    console.log('Adoption evidence consistency: PASS; pilot=' + data.pilot_status +
      '; production approval is not granted by this check.');
  }
} catch {
  console.error('Adoption evidence consistency: INCOMPLETE (unreadable canonical evidence or artifact)');
  process.exitCode = 1;
}

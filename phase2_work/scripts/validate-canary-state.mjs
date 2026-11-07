import { pathToFileURL } from 'node:url';

/**
 * Parse the Cloud Run API's status.traffic projection read from gcloud.
 * A tag is an operational pointer, not an immutable release identity.
 * Only an exact revision with the expected candidate tag may be probed;
 * promotion must change traffic by revision name, never by mutable tag.
 */
export function validateCanaryState(state, phase, revision) {
  if (!['before', 'after'].includes(phase)) throw new Error('Unknown canary validation phase');
  if (typeof revision !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(revision)) {
    throw new Error('Invalid exact candidate revision');
  }
  const traffic = state?.status?.traffic;
  if (!Array.isArray(traffic)) throw new Error('Cloud Run status.traffic must be an array');
  const tagged = traffic.filter(entry => entry && entry.tag === 'candidate');
  if (tagged.length !== 1 || tagged[0].revisionName !== revision) {
    throw new Error('Candidate tag does not uniquely target the expected revision');
  }
  const taggedUrl = tagged[0].url;
  let parsedUrl;
  try { parsedUrl = new URL(taggedUrl); } catch {
    throw new Error('Candidate revision URL is invalid');
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password ||
      parsedUrl.search || parsedUrl.hash || parsedUrl.pathname !== '/' ||
      !parsedUrl.hostname.endsWith('.run.app')) {
    throw new Error('Candidate must use a direct HTTPS Cloud Run tagged URL');
  }

  const percentForRevision = traffic
    .filter(entry => entry?.revisionName === revision)
    .reduce((sum, entry) => {
      const percent = entry.percent === undefined ? 0 : entry.percent;
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
        throw new Error('Invalid candidate traffic percentage');
      }
      return sum + percent;
    }, 0);
  if (phase === 'before' && percentForRevision !== 0) {
    throw new Error('Candidate must have zero traffic before health probes');
  }
  if (phase === 'after' && percentForRevision !== 10) {
    throw new Error('Canary must serve exactly 10% traffic after rollout');
  }
  if (phase === 'after') {
    // Cloud Run reports tagged 0%-traffic entries alongside serving entries;
    // sum only explicitly assigned percentages, and fail if inconsistent.
    const all = traffic.reduce((sum, entry) => {
      const pct = entry?.percent ?? 0;
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
        throw new Error('Cloud Run traffic percentage is invalid');
      }
      return sum + pct;
    }, 0);
    if (all !== 100) throw new Error('Cloud Run traffic percentages must total 100');
  }
  return parsedUrl.origin;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [phase, revision, json] = process.argv.slice(2);
    const origin = validateCanaryState(JSON.parse(json), phase, revision);
    process.stdout.write(origin + '\n');
  } catch (error) {
    console.error('Canary revision validation FAILED: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 2;
  }
}

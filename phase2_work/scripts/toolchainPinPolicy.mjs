export const APPROVED_SETUP_NODE = '949feb2413d6458794dcd2491c4babbbce0c15c1';
export const APPROVED_SETUP_BUN = '0c5077e51419868618aeaa5fe8019c62421857d6';

/** Validate executable uses declarations, not arbitrary comments or substrings. */
export function checkWorkflowToolchain(source, file, expectedNode = '22.23.3') {
  const failures = [];
  const active = source.split(/\r?\n/).filter(line => !/^\s*#/.test(line));
  const uses = active.flatMap(line => {
    const m = /^\s*(?:-\s*)?uses:\s*['"]?([^\s'"#]+)['"]?(?:\s*(?:#.*)?)?$/.exec(line);
    return m ? [m[1]] : [];
  });
  for (const [name, sha] of [
    ['actions/setup-node', APPROVED_SETUP_NODE],
    ['oven-sh/setup-bun', APPROVED_SETUP_BUN],
  ]) {
    const selected = uses.filter(ref => ref.startsWith(name + '@'));
    if (!selected.length || selected.some(ref => ref !== name + '@' + sha)) {
      failures.push(`${file} must use only the approved immutable ${name} revision in executable uses steps.`);
    }
  }
  const versionLines = active.filter(line => /^\s*node-version\s*:/.test(line));
  if (!versionLines.length || versionLines.some(line => !/^\s*node-version:\s*['"]?22\.23\.3['"]?\s*(?:#.*)?$/.test(line))) {
    failures.push(`${file} must pin Node ${expectedNode}.`);
  }
  return failures;
}

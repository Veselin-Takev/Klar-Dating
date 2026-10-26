/** Both build contexts must use the approved, immutable toolchain images. */
export const approvedDockerImages = Object.freeze({
  build: 'oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895',
  runtime: 'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c',
});

export function dockerToolchainFailures(source) {
  const lines = source.replace(/\\\r?\n/g, ' ').split(/\r?\n/);
  const fromLines = lines.filter(line => /^\s*FROM\b/i.test(line));
  const failures = [];
  if (fromLines.length !== 2) failures.push('Exactly the approved build and runtime stages are required.');
  const seen = new Set();
  for (const [index, line] of fromLines.entries()) {
    const match = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)\s+AS\s+(build|runtime)\s*$/i.exec(line);
    if (!match) { failures.push('FROM must use a literal approved image and named build/runtime stage.'); continue; }
    const stage = match[2].toLowerCase();
    if (stage !== (index === 0 ? 'build' : 'runtime')) failures.push('Build must precede the final runtime stage.');
    if (seen.has(stage)) failures.push(`Duplicate ${stage} stage.`);
    seen.add(stage);
    if (match[1] !== approvedDockerImages[stage]) failures.push(`${stage} image must be ${approvedDockerImages[stage]}.`);
  }
  for (const stage of ['build', 'runtime']) if (!seen.has(stage)) failures.push(`Missing ${stage} stage.`);
  return failures;
}

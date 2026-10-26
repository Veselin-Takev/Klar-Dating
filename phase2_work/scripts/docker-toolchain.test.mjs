import assert from 'node:assert/strict';
import test from 'node:test';
import { approvedDockerImages as images, dockerToolchainFailures } from './docker-toolchain.mjs';
const source = `FROM ${images.build} AS build\nFROM ${images.runtime} AS runtime\n`;
test('accepts literal approved images with LF or CRLF', () => {
  assert.deepEqual(dockerToolchainFailures(source), []);
  assert.deepEqual(dockerToolchainFailures(source.replaceAll('\n', '\r\n')), []);
});
test('supports an explicit platform without relaxing image pins', () => {
  assert.deepEqual(dockerToolchainFailures(source.replace('FROM ', 'FROM --platform=linux/amd64 ')), []);
});
for (const [label, altered] of [
  ['different Bun version', source.replace('bun:1.4.2', 'bun:1.4.3')],
  ['unpinned Bun digest', source.replace(/@sha256:[a-f0-9]{64}/, '')],
  ['wrong immutable digest', source.replace('9114c058', '00000000')],
  ['older Node runtime', source.replace('node:22.23.3', 'node:22.0.0')],
  ['variable image indirection', source.replace(images.build, '${BUILD_IMAGE}')],
  ['extra stage', source + 'FROM node:latest AS extra\n'],
  ['missing runtime', source.split('\n')[0]],
  ['duplicate build name', source.replace('AS runtime', 'AS build')],
  ['reversed final stage', source.trim().split('\n').reverse().join('\n')],
  ['missing stage alias', source.replace(' AS runtime', '')],
]) test(`rejects ${label}`, () => { assert.ok(dockerToolchainFailures(altered).length > 0); });

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const names = ['cloud-run', 'service'];
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? 'veselin8606-source';
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(owner)) throw new Error('Invalid GITHUB_REPOSITORY_OWNER.');
const imagePattern = new RegExp(`^ghcr\\.io\\/${owner.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\const imagePattern = /^ghcr\.io\/veselin8606-source\/klar-app@sha256:[0-9a-f]{64}$/;')}\\/klar-app@sha256:[0-9a-f]{64}import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const names = ['cloud-run', 'service'];
);

export function validateImage(image) {
  if (typeof image !== 'string' || !imagePattern.test(image)) {
    throw new Error('Expected the Klar release image with a complete immutable sha256 digest.');
  }
  return image;
}

function readTemplate(root, name) {
  const template = JSON.parse(readFileSync(join(root, 'deploy/templates', `${name}.json`), 'utf8'));
  const containers = template?.spec?.template?.spec?.containers;
  if (template.apiVersion !== 'serving.knative.dev/v1' || template.kind !== 'Service'
    || !Array.isArray(containers) || containers.length !== 1 || 'image' in containers[0]) {
    throw new Error(`Invalid source template: ${name}. Images must come from the release build.`);
  }
  return template;
}

export function checkDeploymentSources(root = process.cwd()) {
  for (const name of names) {
    if (existsSync(join(root, `${name}.yaml`)) || existsSync(join(root, `${name}.yml`))) {
      throw new Error(`Do not commit a second deploy manifest ${name}.yaml; use the generated release artifact.`);
    }
    readTemplate(root, name);
  }
  function scan(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) scan(path);
      else if (/\.(json|ya?ml)$/.test(item.name)) {
        const text = readFileSync(path, 'utf8');
        if (/REPLACE_WITH|PLACEHOLDER|\$\{|<[^>]*DIGEST/i.test(text)) throw new Error(`Unresolved deployment value in ${path}`);
        if (!path.includes(`${join('deploy', 'templates')}/`)) {
          if (!item.name.endsWith('.json')) throw new Error('Generated deployment manifests must use JSON.');
          const manifest = JSON.parse(text);
          const containers = manifest?.spec?.template?.spec?.containers;
          if (manifest.kind !== 'Service' || !Array.isArray(containers) || containers.length !== 1) {
            throw new Error(`Invalid generated manifest: ${path}`);
          }
          for (const container of containers) validateImage(container.image);
        }
      }
    }
  }
  scan(join(root, 'deploy'));
}

export function renderReleaseManifests(image, output, root = process.cwd()) {
  validateImage(image);
  checkDeploymentSources(root);
  const documents = names.map(name => {
    const manifest = readTemplate(root, name);
    manifest.spec.template.spec.containers[0].image = image;
    return { name, manifest };
  });
  mkdirSync(output, { recursive: true });
  for (const { name, manifest } of documents) {
    writeFileSync(join(output, `${name}.json`), JSON.stringify(manifest, null, 2) + '\n');
  }
  return documents.map(({ name }) => join(output, `${name}.json`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [, , command, image, output] = process.argv;
    if (command === 'check') checkDeploymentSources();
    else if (command === 'render' && image && output) renderReleaseManifests(image, output);
    else throw new Error('Usage: release-manifests.mjs check | render <immutable-image> <output-directory>');
    console.log('Deployment manifest checks passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

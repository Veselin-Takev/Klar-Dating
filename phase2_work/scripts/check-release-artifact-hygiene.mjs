import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const forbiddenName = /(?:^|[_-])(stage|staging|artifact|release-candidate)(?:$|[_-])/i;
const forbiddenFile = /\.(zip|sha256|tar\.gz)$/i;

function scan(root, relative = '') {
  for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      if (forbiddenName.test(entry.name)) failures.push(`forbidden staging/artifact directory in release tree: ${path}`);
      else scan(root, path);
    } else if (forbiddenFile.test(entry.name) && !path.startsWith('release/')) {
      failures.push(`release archive source tree contains generated artifact: ${path}`);
    }
  }
}

scan(process.cwd());
if (failures.length) {
  console.error('Release artifact hygiene gate FAILED:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('Release artifact hygiene gate PASS.');

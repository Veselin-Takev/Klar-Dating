import { realpathSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export function validateExternalReportPath(repositoryRoot, reportPath) {
  const root = realpathSync(repositoryRoot);
  const target = resolve(reportPath);
  const parent = realpathSync(dirname(target));
  const rel = relative(root, parent);
  if (rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) {
    throw new Error('Preflight report must be stored outside the repository.');
  }
  try {
    lstatSync(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return target;
    throw error;
  }
  throw new Error('Preflight report path already exists. Use a fresh evidence filename.');
}

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const metricNames = ['initialJsGzipBytes', 'initialCssGzipBytes', 'totalJsGzipBytes', 'largestJsGzipBytes', 'largestJsBytes'];

export function measureBundle(directory) {
  const root = realpathSync(directory);
  const manifest = JSON.parse(readFileSync(resolve(root, '.vite/manifest.json'), 'utf8'));
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') throw new Error('Invalid Vite manifest.');
  const entries = Object.entries(manifest).filter(([, entry]) => entry?.isEntry === true);
  if (entries.length !== 1 || entries[0][0] !== 'index.html') throw new Error('Expected the index.html build entry.');
  const assets = new Map();
  function measure(file) {
    if (typeof file !== 'string' || !file || isAbsolute(file)) throw new Error('Invalid bundle asset path.');
    const path = realpathSync(resolve(root, file));
    const name = relative(root, path);
    if (!name || name === '..' || name.startsWith('..' + sep) || isAbsolute(name)) throw new Error('Bundle asset escapes dist.');
    if (!assets.has(file)) {
      const content = readFileSync(path);
      assets.set(file, { file, bytes: content.length, gzipBytes: gzipSync(content).length });
    }
    return assets.get(file);
  }
  const allJs = new Set();
  for (const entry of Object.values(manifest)) {
    if (!entry || typeof entry.file !== 'string' || !/\.(js|css)$/.test(entry.file)) {
      // Other emitted assets (e.g. fonts or images) are not JavaScript budgets.
      if (!entry || typeof entry.file !== 'string') throw new Error('Invalid bundle entry.');
    }
    if (entry.file.endsWith('.js')) { allJs.add(entry.file); measure(entry.file); }
    for (const property of ['imports', 'dynamicImports', 'css']) {
      if (entry[property] !== undefined && (!Array.isArray(entry[property]) || !entry[property].every(value => typeof value === 'string'))) {
        throw new Error(`Invalid manifest ${property}.`);
      }
    }
    for (const key of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) {
      if (!Object.hasOwn(manifest, key)) throw new Error(`Missing imported chunk: ${key}`);
    }
    for (const css of entry.css ?? []) measure(css);
  }
  const visited = new Set();
  const initialJs = new Set();
  const initialCss = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (entry.file.endsWith('.js')) initialJs.add(entry.file);
    for (const css of entry.css ?? []) initialCss.add(css);
    for (const imported of entry.imports ?? []) visit(imported);
  }
  visit('index.html');
  if (!initialJs.size || !allJs.size) throw new Error('No JavaScript found; refusing an empty budget check.');
  const sum = files => [...files].reduce((total, file) => total + measure(file).gzipBytes, 0);
  return {
    measurements: {
      initialJsGzipBytes: sum(initialJs), initialCssGzipBytes: sum(initialCss),
      totalJsGzipBytes: sum(allJs),
      largestJsGzipBytes: Math.max(...[...allJs].map(file => measure(file).gzipBytes)),
      largestJsBytes: Math.max(...[...allJs].map(file => measure(file).bytes)),
    },
    initialFiles: [...initialJs, ...initialCss].sort(),
    assets: [...assets.values()].sort((a, b) => a.file.localeCompare(b.file)),
  };
}

export function checkBundleBudget(directory, budget) {
  if (budget?.version !== 1 || !budget.limits || Object.keys(budget.limits).length !== metricNames.length
    || metricNames.some(name => !Number.isSafeInteger(budget.limits[name]) || budget.limits[name] <= 0)) {
    throw new Error('Invalid bundle budget; all five positive integer limits are required.');
  }
  const result = measureBundle(directory);
  const failures = metricNames.filter(name => result.measurements[name] > budget.limits[name]);
  return { version: 1, ...result, limits: budget.limits, failures, passed: failures.length === 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [, , directory = 'dist', budgetFile = 'ops/bundle-budget.json', reportFile = 'dist/bundle-report.json'] = process.argv;
    const report = checkBundleBudget(directory, JSON.parse(readFileSync(budgetFile, 'utf8')));
    mkdirSync(dirname(reportFile), { recursive: true });
    writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
    for (const name of metricNames) console.log(`${name}: ${report.measurements[name]} / ${report.limits[name]} bytes`);
    if (!report.passed) throw new Error(`Bundle budget exceeded: ${report.failures.join(', ')}`);
    console.log('Bundle budget passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

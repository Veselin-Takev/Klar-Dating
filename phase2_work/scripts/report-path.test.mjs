import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateExternalReportPath } from './report-path.mjs';
function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'klar-guard-'));
  const repo=join(dir,'repo'), external=join(dir,'external');
  mkdirSync(repo); mkdirSync(external);
  try { fn({repo, external, dir}); } finally { rmSync(dir,{recursive:true,force:true}); }
}
test('allows fresh external report file',()=>fixture(({repo,external})=>{const target=join(external,'report.json');assert.equal(validateExternalReportPath(repo,target),target);}));
test('rejects repository-local file',()=>fixture(({repo})=>assert.throws(()=>validateExternalReportPath(repo,join(repo,'report.json')),/outside/)));
test('rejects symlinked parent pointing into repo',()=>fixture(({repo,external})=>{symlinkSync(repo,join(external,'link'));assert.throws(()=>validateExternalReportPath(repo,join(external,'link','report.json')),/outside/);}));
test('rejects existing evidence file',()=>fixture(({repo,external})=>{const target=join(external,'report.json');writeFileSync(target,'old');assert.throws(()=>validateExternalReportPath(repo,target),/already exists/);}));
test('rejects existing symlink evidence target',()=>fixture(({repo,external})=>{const target=join(external,'report.json');symlinkSync(join(repo,'missing'),target);assert.throws(()=>validateExternalReportPath(repo,target),/already exists/);}));
test('rejects missing parent directory',()=>fixture(({repo,external})=>assert.throws(()=>validateExternalReportPath(repo,join(external,'absent','report.json')),/ENOENT/)));

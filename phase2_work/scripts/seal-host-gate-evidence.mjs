#!/usr/bin/env node
/** Fail-closed, one-time SHA256SUMS writer for CLOSED host result logs only.
 *  Does not validate release GO or authenticate artifact provenance.
 *  Run only after all processes writing evidence logs have terminated.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync, constants, createReadStream, existsSync, fstatSync,
  fsyncSync, linkSync, lstatSync, openSync, readdirSync,
  readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA_LINE = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/;

function fileNoFollow(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new Error(`not a regular evidence file: ${basename(path)}`);
    if (st.nlink !== 1) throw new Error(`hard-linked evidence file: ${basename(path)}`);
    return { fd, st };
  } catch (e) { closeSync(fd); throw e; }
}
async function hashFile(path) {
  const {fd, st} = fileNoFollow(path);
  const h = createHash('sha256');
  // Using an already-open file descriptor avoids following a substituted symlink.
  for await (const chunk of createReadStream(path, {fd, autoClose: true})) h.update(chunk);
  const after = lstatSync(path);
  // A change while hashing is cause for rejection, not an acceptable snapshot.
  if (!after.isFile() || after.nlink !== 1 || after.dev !== st.dev ||
      after.ino !== st.ino || after.size !== st.size ||
      after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) {
    throw new Error(`file changed while collecting evidence: ${basename(path)}`);
  }
  return h.digest('hex');
}

function readManifest(input) {
  const records = new Map();
  for (const line of input.trimEnd().split('\n')) {
    const hit = SHA_LINE.exec(line);
    if (!hit || records.has(hit[2]) || hit[2] === 'SHA256SUMS') {
      throw new Error('noncanonical or duplicate SHA256SUMS record');
    }
    records.set(hit[2], hit[1]);
  }
  return records;
}

/** Seal a completed host run. Failed gates are retained verbatim and can also be sealed. */
export async function sealHostEvidence(inputDir) {
  const dir = resolve(inputDir);
  if (!lstatSync(dir).isDirectory()) throw new Error('host results must be a real directory');
  const final = join(dir, 'SHA256SUMS');
  if (existsSync(final)) throw new Error('SHA256SUMS already exists; refuse to overwrite a sealed run');
  const files = readdirSync(dir, {withFileTypes: true});
  if (!files.length) throw new Error('cannot seal empty evidence directory');
  for (const ent of files) {
    if (!ent.isFile() || !SAFE_NAME.test(ent.name) || ent.name === 'SHA256SUMS' || ent.name.startsWith('SHA256SUMS.tmp')) {
      throw new Error(`untrusted evidence entry: ${ent.name}`);
    }
  }
  const names = files.map(f=>f.name).sort((a,b)=>a < b ? -1 : a > b ? 1 : 0);
  const hashes = new Map();
  for (const name of names) hashes.set(name, await hashFile(join(dir,name)));
  // Re-hash immediately before publishing the manifest to catch unstable writers.
  for (const name of names) {
    if (await hashFile(join(dir,name)) !== hashes.get(name)) throw new Error(`evidence changed during sealing: ${name}`);
  }
  // Reject newly created, removed or replaced directory entries before
  // committing a manifest. A closed evidence directory must remain quiescent.
  const current = readdirSync(dir, {withFileTypes:true}).map(f=>f.name).sort();
  if (current.length !== names.length || current.some((n,i)=>n !== names[i])) {
    throw new Error('evidence directory entries changed during sealing');
  }
  const content = names.map(name => `${hashes.get(name)}  ${name}`).join('\n') + '\n';
  const temp = join(dir, `SHA256SUMS.tmp-${randomBytes(12).toString('hex')}`);
  let pending = false;
  try {
    const fd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    pending = true;
    try {writeFileSync(fd, content, {encoding:'utf8'});fsyncSync(fd);}finally{closeSync(fd);}
    // Atomic create: unlike rename(), link() fails if SHA256SUMS already exists.
    linkSync(temp, final);
    unlinkSync(temp);pending = false;
    const parsed = readManifest(readFileSync(final,'utf8'));
    if (parsed.size !== names.length) throw new Error('sealed manifest does not cover every evidence file');
    for (const name of names) {
      if (parsed.get(name) !== await hashFile(join(dir,name))) {
        throw new Error(`evidence changed after sealing: ${name}`);
      }
    }
    return {
      release_decision: 'NO-GO',
      manifest_sha256: createHash('sha256').update(content,'utf8').digest('hex'),
      entries: names.length,
      disclaimer: 'Manifest integrity is not a signed host attestation, independent approval or production release authorization.',
    };
  } finally {
    if (pending && existsSync(temp)) unlinkSync(temp);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--dir') {
    console.error('Usage: node scripts/seal-host-gate-evidence.mjs --dir /path/to/closed/results');
    process.exitCode = 2;
  } else {
    try {
      const result = await sealHostEvidence(process.argv[3]);
      console.log(JSON.stringify(result,null,2));
      process.exitCode = 0;
    } catch (e) {
      console.error(JSON.stringify({release_decision:'NO-GO',error:String(e.message)}));
      process.exitCode = 1;
    }
  }
}

import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const audio = fs.readFileSync('src/server/platform/journalAudioBoundary.ts', 'utf8');

const failures = [];
if (!server.includes('app.use(express.json({ limit: "900kb", strict: true }));')) {
  failures.push('Global JSON parser must enforce a strict 900kb body limit.');
}
if (server.includes('app.use(express.json({ limit: "1mb"')) {
  failures.push('Legacy 1mb global JSON parser limit must not return.');
}
const audioMatch = audio.match(/JOURNAL_AUDIO_MAX_BYTES\s*=\s*(\d+)\s*\*\s*1024/);
if (!audioMatch) failures.push('Journal audio byte limit must remain statically discoverable.');
else if (Number(audioMatch[1]) > 600) failures.push('Journal audio decoded payload must remain <= 600 KiB.');

if (failures.length) {
  console.error('JSON body boundary: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('JSON body boundary: PASS');

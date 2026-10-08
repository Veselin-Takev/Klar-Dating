import fs from 'node:fs';

const source = fs.readFileSync('src/lib/api.ts', 'utf8');
const start = source.indexOf('export async function fetchWithCache');
const end = source.indexOf('export async function fetchWithTimeout', start);
if (start < 0 || end < 0) throw new Error('fetchWithCache boundary not found');
const cache = source.slice(start, end);

if (/localStorage|sessionStorage/.test(cache)) {
  throw new Error('fetchWithCache must not persist personalized API responses in web storage');
}
if (!cache.includes('auth.currentUser?.uid')) {
  throw new Error('fetchWithCache must bind cache entries to the authenticated Firebase UID');
}
if (!cache.includes('cacheKeyFor(uid, resource, options.body)')) {
  throw new Error('fetchWithCache cache key is not UID-bound');
}
console.log('API cache boundary gate PASS: personalized POST responses are UID-bound and memory-only.');

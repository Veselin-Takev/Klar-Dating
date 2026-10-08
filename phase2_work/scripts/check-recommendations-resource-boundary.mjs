import fs from 'node:fs';
import path from 'node:path';

const route = fs.readFileSync(path.resolve('src/server/routes/profileRecommendations.ts'), 'utf8');
const platform = fs.readFileSync(path.resolve('src/server/platform/launchPlatform.ts'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

const required = [
  "windowMs: 60 * 1000",
  "limit: 20",
  "keyGenerator: (req) => deps.currentUserId(req) ?? req.ip ?? 'unknown'",
  "router.get('/recommendations', recommendationReadLimiter",
];
for (const marker of required) {
  if (!route.includes(marker)) throw new Error(`Recommendation resource boundary missing: ${marker}`);
}
if (!platform.includes(".collection('public_profiles').where('location', '==', city).limit(500)")) {
  throw new Error('Recommendation candidate scan cap missing.');
}
if (!platform.includes('if (page >= 50) throw new Error(\'Block list scan budget exceeded\');')) {
  throw new Error('Recommendation block-list scan budget missing.');
}
if (typeof pkg.scripts?.['check:recommendations-resource-boundary'] !== 'string') {
  throw new Error('Recommendation resource boundary gate is not registered.');
}
console.log('Recommendations resource boundary: PASS');

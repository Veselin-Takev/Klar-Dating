import { readFileSync } from 'node:fs';
const component=readFileSync('src/components/DashboardOnboarding.tsx','utf8');
const dashboard=readFileSync('src/screens/Dashboard.tsx','utf8');
if ((dashboard.match(/<AppTour\s*\/>/g)||[]).length || /from ['"]\.\.\/components\/AppTour['"]/.test(dashboard)) throw new Error('Duplicate AppTour remains mounted in Dashboard');
for (const token of ['klar_onboarding_state','ONBOARDING_VERSION','onboarding_v2_started','onboarding_v2_completed']) if (!component.includes(token)) throw new Error('Missing onboarding v2 invariant: '+token);
if (!component.includes('useTranslation')) throw new Error('Onboarding must use i18n');
console.log('PASS — single versioned onboarding flow and deterministic activation IDs');

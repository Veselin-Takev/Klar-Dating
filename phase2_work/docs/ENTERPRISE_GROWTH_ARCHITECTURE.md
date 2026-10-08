# Enterprise Growth Architecture

## Domains
1. Identity & Verification
2. Trust & Safety
3. Compatibility & Recommendations
4. Activation & Referrals
5. Date Loop & Outcomes
6. Analytics & Experimentation

## Privacy boundary
`users` bleibt privat. `public_profiles` ist ein serverseitig erzeugter, minimierter Spiegel. Der Spiegel darf niemals Mood, Journal, Billing, consent, birth date, roles oder Trust-Interna enthalten.

## Recommendation policy
Production Recommendations dürfen nur Profile ausgeben, die:
- verifiziert sind,
- aktiv sind,
- in den letzten 7 Tagen aktiv waren,
- nicht blockiert sind,
- innerhalb des lokalen Launch-Markts liegen.

## Meaningful connection optimization
Engagement wird nicht als alleinige Optimierungsgröße verwendet. Ranking soll langfristig zu Gespräch, Date-Planung und positiver Reflexion beitragen.

## Rollout
Feature Flags + City launch + canary deployment. Keine bundesweite Aktivierung, bevor die lokale Dichte ausreicht.

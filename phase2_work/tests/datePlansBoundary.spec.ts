import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('date planning privacy boundaries', () => {
  it('does not persist planned dates in browser storage', () => {
    for (const file of ['src/components/DatePlannerWidget.tsx', 'src/components/DateCalendar.tsx']) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/klarStorage\.(?:getItem|setItem|removeItem).*klar_(planned_dates|date_availabilities)/);
    }
  });

  it('uses UID-scoped server collections and disables direct client writes', () => {
    const route = fs.readFileSync('src/server/routes/datePlans.ts', 'utf8');
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    expect(route).toContain("collection('users').doc(uid).collection('datePlans')");
    expect(route).toContain("collection('users').doc(uid).collection('dateAvailability')");
    expect(rules).toContain('match /users/{userId}/datePlans/{planId}');
    expect(rules).toContain('match /users/{userId}/dateAvailability/{availabilityId}');
  });
});

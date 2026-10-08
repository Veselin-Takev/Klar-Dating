import { DatePlannerWidget } from './DatePlannerWidget';

/**
 * Compatibility wrapper for existing Dashboard placements.
 * The actual planner is server-authoritative and no longer simulates map data
 * or stores planned dates in browser storage.
 */
export function SmartDatePlannerWidget({ location }: { location?: string | null }) {
  return <DatePlannerWidget location={location ?? null} userInterests={[]} />;
}

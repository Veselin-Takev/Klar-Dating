/** Shared shape consumed by date history export and chart views. */
export interface DateHistoryEntry {
  id: string;
  matchName: string;
  title: string;
  date: string;
  rating?: number;
  note?: string;
}

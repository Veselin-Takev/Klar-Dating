export type BundleMetric = 'initialJsGzipBytes' | 'initialCssGzipBytes' | 'totalJsGzipBytes' | 'largestJsGzipBytes' | 'largestJsBytes';
export interface BundleMeasurement {
  measurements: Record<BundleMetric, number>;
  initialFiles: string[];
  assets: Array<{ file: string; bytes: number; gzipBytes: number }>;
}
export interface BundleReport extends BundleMeasurement {
  version: 1;
  limits: Record<BundleMetric, number>;
  failures: BundleMetric[];
  passed: boolean;
}
export function measureBundle(directory: string): BundleMeasurement;
export function checkBundleBudget(directory: string, budget: unknown): BundleReport;

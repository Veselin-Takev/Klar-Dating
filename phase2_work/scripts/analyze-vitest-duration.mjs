import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function analyzeVitestReport(report) {
  if (!report || !Array.isArray(report.testResults) || report.testResults.length === 0) {
    throw new Error('Expected a non-empty Vitest JSON testResults array.');
  }
  const suites = report.testResults.map((suite) => {
    const start = suite.perfStats?.start ?? suite.startTime;
    const end = suite.perfStats?.end ?? suite.endTime;
    const duration = Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
    if (!Number.isFinite(duration)) throw new Error('Missing or invalid suite timing.');
    return {
      suite: String(suite.name ?? 'unknown'),
      durationMs: Math.round(duration),
      tests: Array.isArray(suite.assertionResults) ? suite.assertionResults.length : 0,
      status: String(suite.status ?? 'unknown'),
    };
  });
  suites.sort((a, b) => b.durationMs - a.durationMs || a.suite.localeCompare(b.suite));
  return { suiteCount: suites.length, totalSuiteDurationMs: suites.reduce((sum, s) => sum + s.durationMs, 0), slowest: suites.slice(0, 15), note: 'Summed suite durations are not wall-clock or billable runner time.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/analyze-vitest-duration.mjs path/to/vitest-report.json');
    console.log(JSON.stringify(analyzeVitestReport(JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'))), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

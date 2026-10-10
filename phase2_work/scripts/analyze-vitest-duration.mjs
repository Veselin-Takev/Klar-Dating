import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function analyzeVitestReport(report) {
  if (!report || !Array.isArray(report.testResults) || report.testResults.length === 0) {
    throw new Error('Expected a non-empty Vitest JSON testResults array.');
  }
  if (typeof report.success !== 'boolean') throw new Error('Missing Vitest overall success status.');
  if (!Number.isSafeInteger(report.numTotalTests) || report.numTotalTests < 1) throw new Error('Invalid Vitest total test count.');
  if (report.numFailedTests !== undefined && (!Number.isSafeInteger(report.numFailedTests) || report.numFailedTests < 0 || report.numFailedTests > report.numTotalTests)) throw new Error('Invalid Vitest failed test count.');
  if (report.success && report.numFailedTests > 0) throw new Error('Inconsistent Vitest overall success status.');
  const suites = report.testResults.map((suite) => {
    if (typeof suite.name !== 'string' || suite.name.trim() === '') throw new Error('Missing suite name.');
    if (!Array.isArray(suite.assertionResults)) throw new Error('Missing suite assertions.');
    if (!['passed', 'failed', 'pending'].includes(suite.status)) throw new Error('Unknown suite status.');
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
  const measuredTests = suites.reduce((sum, s) => sum + s.tests, 0);
  if (measuredTests !== report.numTotalTests) throw new Error('Incomplete Vitest test report.');
  if (report.success && suites.some(s => s.status !== 'passed')) throw new Error('Inconsistent Vitest overall success status.');
  suites.sort((a, b) => b.durationMs - a.durationMs || a.suite.localeCompare(b.suite));
  return { overallStatus: report.success ? 'PASS' : 'FAIL', suiteCount: suites.length, totalSuiteDurationMs: suites.reduce((sum, s) => sum + s.durationMs, 0), slowest: suites.slice(0, 15), note: 'Summed suite durations are not wall-clock or billable runner time.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/analyze-vitest-duration.mjs path/to/vitest-report.json');
    const analysis = analyzeVitestReport(JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8')));
    console.log(JSON.stringify(analysis, null, 2));
    if (analysis.overallStatus !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

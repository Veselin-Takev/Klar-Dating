import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
// Exercise the installed pinned CLI; this is an upgrade regression guard, not a live deploy.
const { SourceTokenScraper } = require('firebase-tools/lib/deploy/functions/release/sourceTokenScraper.js') as {
  SourceTokenScraper: new () => { withToken<T>(operation: (token: string | undefined) => Promise<T>): Promise<T> };
};
describe('Firebase Tools #10755 deployment retry regression', () => {
  it('releases a waiting operation after a failed first attempt', async () => {
    const scraper = new SourceTokenScraper();
    let fail!: (error: Error) => void;
    const first = scraper.withToken(() => new Promise<void>((_, reject) => { fail = reject; }));
    const rejected = expect(first).rejects.toThrow('409');
    await Promise.resolve();
    const waiting = scraper.withToken(async token => ({ token, completed: true }));
    fail(new Error('409 unable to queue the operation'));
    await rejected;
    expect(await waiting).toEqual({ token: undefined, completed: true });
  }, 2000);
});

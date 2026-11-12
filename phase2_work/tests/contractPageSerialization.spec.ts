// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderContractForm, renderContractReceipt } from '../src/server/contractPages';
import { emulatorCsp } from '../src/server/emulatorCsp';

describe('statutory public form serialization', () => {
  it('escapes receipt text and download attributes while preserving the downloadable receipt', () => {
    const receipt = { id: '\" onmouseover=\"alert(1)', text: '<script>alert(1)</script> & receipt' };
    const html = renderContractReceipt('de', receipt);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('download="Klar-" onmouseover=');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain(encodeURIComponent(receipt.text));
  });
  it.each(['cancel', 'withdraw'] as const)('preserves the no-JavaScript %s form contract', kind => {
    const html = renderContractForm('de', kind);
    expect(html).toMatch(/<title>[^<]+ · Klar<\/title>/);
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/vertraege/erklaerung"');
    expect(html).toContain(`name="kind" value="${kind}"`);
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('<script');
  });
});
describe('emulator CSP origin validation', () => {
  it('permits explicit loopback ports only', () => {
    expect(emulatorCsp('127.0.0.1:8080', '[::1]:9099')).toEqual({verbindung:['http://127.0.0.1:8080','ws://127.0.0.1:8080','http://[::1]:9099','ws://[::1]:9099'],rahmen:['http://[::1]:9099']});
  });
  it.each(['remote.example:8080', 'user:password@127.0.0.1:8080', 'localhost:8080/path', 'localhost:8080?query=1', 'localhost:8080#fragment', 'localhost'])('rejects unsafe CSP input %s', host => {
    expect(() => emulatorCsp(host)).toThrow();
  });
});

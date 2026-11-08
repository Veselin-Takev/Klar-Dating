// Firebase CLI 15.31 creates an explicit Undici ProxyAgent even for loopback
// cross-service Storage -> Firestore lookups, ignoring NO_PROXY. Preserve the
// inherited outbound proxy; only real loopback emulator traffic goes direct.
// No data or rule evaluation is mocked. This preload runs only for demo exec.
const {createRequire} = require('node:module');
const {basename} = require('node:path');
const command = process.argv[2];
const projectIndex = process.argv.indexOf('--project');
if (basename(process.argv[1] || '') === 'firebase.js' && command === 'emulators:exec'
    && projectIndex >= 0 && /^demo-[a-z0-9-]+$/.test(process.argv[projectIndex + 1] || '')) {
  const cliRequire = createRequire(require.resolve('firebase-tools/package.json'));
  const undici = cliRequire('undici');
  const OriginalProxyAgent = undici.ProxyAgent;
  const local = new undici.Agent();
  undici.ProxyAgent = class extends OriginalProxyAgent {
    dispatch(options, handler) {
      const url = new URL(options.origin);
      if (url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
        return local.dispatch(options, handler);
      }
      return super.dispatch(options, handler);
    }
  };
}

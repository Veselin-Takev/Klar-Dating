import { auth } from './firebase';

/** Only the current Firebase session can supply credentials. */
export async function getValidAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdToken();
    if (auth.currentUser?.uid !== user.uid || !token || token.split('.').length !== 3) return null;
    return token;
  } catch {
    return null;
  }
}

function isAppApi(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/')
      && !url.username && !url.password;
  } catch { return false; }
}

async function apiHeaders(input: RequestInfo | URL, init?: RequestInit) {
  // Fetch init headers replace Request headers; absent init preserves them.
  const inherited = typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined;
  const headers = new Headers(init?.headers ?? inherited);
  if (!headers.has('Authorization')) {
    const token = await getValidAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!isAppApi(url)) throw new Error('Authenticated requests require a same-origin API URL.');
  const headers = await apiHeaders(url, options);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  return fetch(url, { ...options, headers });
}

const installedWrappers = new WeakSet<typeof fetch>();
export function installAuthFetch(): void {
  if (typeof window === 'undefined' || installedWrappers.has(window.fetch)) return;
  const originalFetch = window.fetch.bind(window);
  const customFetch: typeof fetch = async (input, init) => {
    if (!isAppApi(input)) return originalFetch(input, init);
    return originalFetch(input, { ...init, headers: await apiHeaders(input, init) });
  };
  try {
    window.fetch = customFetch;
    installedWrappers.add(customFetch);
  } catch {
    // Startup must remain possible in runtimes with a non-writable fetch.
    console.warn('Authenticated fetch could not be installed.');
  }
}

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, setPersistence, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { AuthProvider, useAuth } from '../src/lib/AuthContext';
import { hasDiagnosticsConsent, setDiagnosticsConsent } from '../src/lib/telemetryPrivacy';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  listener: undefined as unknown as (user: User | null) => Promise<void>,
  snapshot: undefined as unknown as (data: any) => void,
  read: vi.fn(),
}));
vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _collection: string, uid: string) => ({ uid }),
  getDocFromServer: mocks.read,
  setDoc: vi.fn(), updateDoc: vi.fn(),
  waitForPendingWrites: vi.fn().mockResolvedValue(undefined),
  onSnapshot: (_ref: unknown, _options: unknown, callback: typeof mocks.snapshot) => { mocks.snapshot = callback; return vi.fn(); },
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: typeof mocks.listener) => { mocks.listener = callback; return vi.fn(); },
  getRedirectResult: vi.fn().mockResolvedValue(null),
  signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), signInAnonymously: vi.fn(),
  GoogleAuthProvider: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(), setPersistence: vi.fn(),
  browserLocalPersistence: {}, browserSessionPersistence: {},
}));
let context: ReturnType<typeof useAuth>;
function Probe() { context = useAuth(); return <output>{JSON.stringify(context.profileData)}</output>; }
const grant = { version: 1, zwecke: { fehlerberichte: true }, widerrufenAm: null };
const snapshot = (data: Record<string, unknown>) => ({ exists: () => true, data: () => data, metadata: { hasPendingWrites: false, fromCache: false } });
const account = (uid: string) => ({ uid, isAnonymous: false, getIdToken: async () => 'test-token' }) as User;
async function signIn(uid: string) {
  await act(async () => { mocks.auth.currentUser = account(uid); await mocks.listener(mocks.auth.currentUser); });
}
beforeEach(() => {
  localStorage.clear(); mocks.read.mockReset(); mocks.auth.currentUser = null; setDiagnosticsConsent(false);
  render(<AuthProvider><Probe /></AuthProvider>);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); setDiagnosticsConsent(false); });

describe('authoritative profile state', () => {
  it('ignores every legacy browser age, consent and profile override', async () => {
    for (const key of ['klar_is_adult', 'klar_is_adult_alice']) localStorage.setItem(key, 'true');
    for (const key of ['klar_einwilligung', 'klar_einwilligung_alice']) localStorage.setItem(key, JSON.stringify(grant));
    localStorage.setItem('klar_user_state_alice', JSON.stringify({ isAdult: true, einwilligung: grant }));
    localStorage.setItem('klar_einw_fehlerberichte', 'ja');
    mocks.read.mockResolvedValue(snapshot({ uid: 'alice', isAdult: false, einwilligung: null }));
    await signIn('alice');
    expect(context.profileData).toMatchObject({ uid: 'alice', isAdult: false, einwilligung: null });
    expect(hasDiagnosticsConsent()).toBe(false);
    expect(context.loading).toBe(false);
  });

  it('applies server revocations rather than keeping a previous grant', async () => {
    mocks.read.mockResolvedValue(snapshot({ uid: 'alice', isAdult: true, einwilligung: grant }));
    await signIn('alice');
    expect(hasDiagnosticsConsent()).toBe(true);
    act(() => mocks.snapshot(snapshot({ uid: 'alice', isAdult: false, einwilligung: null })));
    expect(context.profileData?.isAdult).toBe(false);
    expect(hasDiagnosticsConsent()).toBe(false);
  });

  it('clears authorization when the authoritative refresh fails', async () => {
    mocks.read.mockResolvedValue(snapshot({ uid: 'alice', isAdult: true, einwilligung: grant }));
    await signIn('alice');
    mocks.read.mockRejectedValueOnce(new Error('unavailable'));
    await act(async () => { await expect(context.refreshProfile()).rejects.toThrow('unavailable'); });
    expect(context.profileData).toBeNull();
    expect(hasDiagnosticsConsent()).toBe(false);
  });

  it('does not apply a late read from a previous account', async () => {
    let finish!: (value: ReturnType<typeof snapshot>) => void;
    mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let oldRequest!: Promise<void>;
    await act(async () => { mocks.auth.currentUser = account('alice'); oldRequest = mocks.listener(mocks.auth.currentUser); });
    mocks.read.mockResolvedValue(snapshot({ uid: 'bob', isAdult: false }));
    await signIn('bob');
    await act(async () => { finish(snapshot({ uid: 'alice', isAdult: true, einwilligung: grant })); await oldRequest; });
    expect(screen.getByRole('status').textContent).toContain('bob');
    expect(context.profileData?.isAdult).toBe(false);
    expect(hasDiagnosticsConsent()).toBe(false);
  });

  it('works with blocked browser storage and never authorizes a cached snapshot', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    mocks.read.mockResolvedValue(snapshot({ uid: 'alice', isAdult: false }));
    await signIn('alice');
    act(() => mocks.snapshot({ ...snapshot({ isAdult: true, einwilligung: grant }), metadata: { fromCache: true, hasPendingWrites: false } }));
    expect(context.profileData?.isAdult).toBe(false);
    expect(hasDiagnosticsConsent()).toBe(false);
  });
  it('revokes consent and adult state when an authoritative server snapshot omits those fields', async () => {
    mocks.read.mockResolvedValue(snapshot({ uid: 'alice', isAdult: true, einwilligung: grant }));
    await signIn('alice');
    expect(hasDiagnosticsConsent()).toBe(true);
    act(() => mocks.snapshot(snapshot({ uid: 'alice', name: 'Alice' })));
    expect(context.profileData?.isAdult).not.toBe(true);
    expect(hasDiagnosticsConsent()).toBe(false);
  });

  it.each(['signInWithEmail', 'signUpWithEmail'] as const)(
    'sets durable Firebase persistence before %s rather than inheriting guest session scope',
    async (operation) => {
      const persist = vi.mocked(setPersistence);
      const login = vi.mocked(signInWithEmailAndPassword);
      const signup = vi.mocked(createUserWithEmailAndPassword);
      persist.mockReset();
      login.mockReset();
      signup.mockReset();
      let finishPersistence!: () => void;
      persist.mockImplementationOnce(() => new Promise<void>(resolve => { finishPersistence = resolve; }));
      login.mockResolvedValue({} as Awaited<ReturnType<typeof signInWithEmailAndPassword>>);
      signup.mockResolvedValue({} as Awaited<ReturnType<typeof createUserWithEmailAndPassword>>);
      const authentication = context[operation]('test@example.invalid', 'test-password');
      expect(login).not.toHaveBeenCalled();
      expect(signup).not.toHaveBeenCalled();
      await act(async () => { finishPersistence(); await authentication; });
      expect(persist).toHaveBeenCalledWith(mocks.auth, browserLocalPersistence);
      const authCall = operation === 'signInWithEmail' ? login : signup;
      expect(authCall).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects profile save confirmation when the server view still has pending writes', async () => {
    mocks.read.mockResolvedValue(snapshot({ uid: 'alice', isAdult: true }));
    await signIn('alice');
    mocks.read.mockResolvedValueOnce({
      ...snapshot({ uid: 'alice', interests: ['Musik'] }),
      metadata: { fromCache: false, hasPendingWrites: true },
    });
    await act(async () => {
      await expect(context.updateProfileData({ interests: ['Musik'] })).rejects.toThrow('serverseitig bestätigt');
    });
  });

  it.each(['signInWithEmail', 'signUpWithEmail'] as const)(
    'does not authenticate through %s when persistence fails', async operation => {
      vi.mocked(setPersistence).mockRejectedValueOnce(new Error('Persistence unavailable'));
      const authCall = operation === 'signInWithEmail' ? vi.mocked(signInWithEmailAndPassword) : vi.mocked(createUserWithEmailAndPassword);
      authCall.mockClear();
      await expect(context[operation]('test@example.invalid', 'test-password')).rejects.toThrow('Persistence unavailable');
      expect(authCall).not.toHaveBeenCalled();
    },
  );

  it('keeps guest authentication scoped to the browser session', async () => {
    vi.mocked(setPersistence).mockResolvedValueOnce(undefined);
    vi.mocked(signInAnonymously).mockClear();
    await context.signInAsGuest();
    expect(setPersistence).toHaveBeenLastCalledWith(mocks.auth, browserSessionPersistence);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });
});

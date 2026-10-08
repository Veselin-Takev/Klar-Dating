import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/AuthContext';
import { auth } from '../lib/firebase';
import { authFetch } from '../lib/authFetch';
import i18n from './config';
import { isSupportedLanguage, type SupportedLanguage } from './locale';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const Context = createContext({ state: 'idle' as SaveState, change: async (language: SupportedLanguage) => { await i18n.changeLanguage(language); } });
export const useLanguagePreference = () => useContext(Context);
export function LanguagePreferenceProvider({ children }: { children: ReactNode }) {
  const { user, profileData } = useAuth();
  const appliedAccount = useRef<string | null>(null);
  const sequence = useRef(0);
  const queue = useRef(Promise.resolve());
  const [state, setState] = useState<SaveState>('idle');
  useEffect(() => {
    if (!user) { appliedAccount.current = null; sequence.current++; setState('idle'); return; }
    if (!profileData || appliedAccount.current === user.uid) return;
    appliedAccount.current = user.uid;
    if (isSupportedLanguage(profileData.language)) void i18n.changeLanguage(profileData.language);
  }, [user, profileData]);
  const change = async (language: SupportedLanguage) => {
    await i18n.changeLanguage(language);
    const version = ++sequence.current;
    if (!user) { setState('idle'); return; }
    const account = user;
    appliedAccount.current = account.uid;
    setState('saving');
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (auth.currentUser?.uid !== account.uid) return;
      const token = await account.getIdToken();
      if (auth.currentUser?.uid !== account.uid) return;
      const response = await authFetch('/api/account/preferences', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ language }), signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Preference persistence failed');
      if (version === sequence.current && auth.currentUser?.uid === account.uid) setState('saved');
    }).catch(() => { if (version === sequence.current && auth.currentUser?.uid === account.uid) setState('error'); });
    await queue.current;
  };
  return <Context.Provider value={{ state, change }}>{children}</Context.Provider>;
}

import { useEffect, useRef, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { InterestsSettings } from '../components/InterestsSettings';
import { BackNavigation } from '../components/BackNavigation';
import { useAuth } from '../lib/AuthContext';
import { useModalAccessibility } from '../lib/useModalAccessibility';

export function ProfileSettings({ initialInterests, onSave }: { initialInterests: string[], onSave: (interests: string[]) => void }) {
  const { t } = useTranslation();
  const { user, logOut, updateProfileData } = useAuth();
  const initialInterestsKey = JSON.stringify(initialInterests ?? []);
  const [interests, setInterests] = useState<string[]>(() => [...(initialInterests ?? [])]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveRequest = useRef(0);
  const saveInFlight = useRef(false);
  useEffect(() => {
    saveInFlight.current = false;
    setSaving(false);
    return () => { ++saveRequest.current; };
  }, [user?.uid]);
  // A different profile/authoritative prop update invalidates local draft state.
  // The stable serialized key avoids resetting edits on parent re-renders.
  useEffect(() => {
    setInterests(JSON.parse(initialInterestsKey) as string[]);
    setSaveError(false);
  }, [initialInterestsKey, user?.uid]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutTitleId = useId();
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(() => setShowLogoutConfirm(false), showLogoutConfirm);

  const handleSave = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    const request = ++saveRequest.current;
    const savedInterests = [...interests];
    setSaving(true);
    setSaveError(false);
    try {
      // AuthContext writes via Firebase and validates the authoritative server
      // readback. Never report success based only on an HTTP response status.
      await updateProfileData({ interests: savedInterests });
      if (request === saveRequest.current) onSave(savedInterests);
    } catch {
      if (request === saveRequest.current) setSaveError(true);
    } finally {
      if (request === saveRequest.current) {
        saveInFlight.current = false;
        setSaving(false);
      }
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logOut();
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <BackNavigation fallback="/profile" dirty={JSON.stringify(interests) !== JSON.stringify(initialInterests || [])} />
      <h2 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h2>
      
      <InterestsSettings 
        selectedInterests={interests} 
        onChange={setInterests} 
      />

      <button
        type="button"
        onClick={() => { void handleSave(); }}
        disabled={saving}
        aria-describedby={saveError ? 'profile-settings-save-error' : undefined}
        className="w-full min-h-11 disabled:opacity-50 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors"
      >
        {saving ? 'Speichert …' : t('actions.save')}
      </button>
      {saveError && (
        <p id="profile-settings-save-error" role="alert" className="text-sm text-red-700 dark:text-red-300">
          Die Änderungen konnten nicht bestätigt werden. Bitte erneut versuchen.
        </p>
      )}

      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500 mb-3">App-Version</p>
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full min-h-11 py-3 px-4 text-red-600 border border-red-200 hover:bg-red-50 font-medium rounded-lg transition-colors"
        >
          Abmelden
        </button>
      </div>

      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div
            ref={dialogRef}
            onKeyDown={onKeyDown}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={logoutTitleId}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-stone-800 p-6 shadow-xl"
          >
            <h3 id={logoutTitleId} className="text-xl font-semibold text-gray-900 dark:text-white">Abmelden?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-stone-300">
              Deine lokale Sitzung und nutzerbezogenen App-Daten werden bereinigt. Serverseitig werden bestehende Sitzungserneuerungen ebenfalls ungültig.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 min-h-11 rounded-lg border border-gray-200 dark:border-stone-600 px-4 py-2 font-medium text-gray-700 dark:text-stone-200"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => { void handleLogout(); }}
                className="flex-1 min-h-11 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

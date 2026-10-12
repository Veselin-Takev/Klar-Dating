import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { InterestsSettings } from '../components/InterestsSettings';
import { BackNavigation } from '../components/BackNavigation';
import { useAuth } from '../lib/AuthContext';
import { useModalAccessibility } from '../lib/useModalAccessibility';

export function ProfileSettings({ initialInterests, onSave }: { initialInterests: string[], onSave: (interests: string[]) => void }) {
  const { t } = useTranslation();
  const { logOut } = useAuth();
  const [interests, setInterests] = useState<string[]>(initialInterests || []);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutTitleId = useId();
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(() => setShowLogoutConfirm(false), showLogoutConfirm);

  const handleSave = async () => {
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interests }),
    });
    onSave(interests);
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
        onClick={handleSave}
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors"
      >
        {t('actions.save')}
      </button>

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

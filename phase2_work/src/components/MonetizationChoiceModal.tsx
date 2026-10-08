import React from "react";
import { useNavigate } from "react-router";

export interface MonetizationChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchAd?: () => void;
  isLoadingAd?: boolean;
  onSelectSubscription?: () => void;
  onSelectRewardAd?: () => void;
}

export const MonetizationChoiceModal: React.FC<MonetizationChoiceModalProps> = ({
  isOpen,
  onClose,
  onWatchAd,
  isLoadingAd = false,
  onSelectSubscription,
  onSelectRewardAd,
}) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const handleSub = () => {
    if (onSelectSubscription) {
      onSelectSubscription();
    } else {
      onClose();
      navigate('/klar-plus');
    }
  };

  const handleAd = () => {
    if (onWatchAd) {
      onWatchAd();
    } else if (onSelectRewardAd) {
      onSelectRewardAd();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl">
        <h2 className="text-xl font-bold text-center">Faire Auswahl</h2>
        <p className="mt-2 text-center text-xs text-neutral-400">
          Du entscheidest neutral ohne Dark Patterns. Wähle werbefrei per Abo oder unterstütze die Plattform über einen einzelnen Werbeclip.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Option A: Abo */}
          <div className="flex flex-col justify-between rounded-xl border border-neutral-700 bg-neutral-800 p-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Abonnement</span>
              <h3 className="mt-1 font-bold">Klar Premium</h3>
              <p className="mt-1 text-xs text-neutral-300">100% werbefrei, unlimitierte Qualitäts-Vorschläge.</p>
            </div>
            <button
              type="button"
              onClick={handleSub}
              className="mt-4 w-full rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition"
            >
              Abo wählen
            </button>
          </div>

          {/* Option B: Belohnungswerbung */}
          <div className="flex flex-col justify-between rounded-xl border border-neutral-700 bg-neutral-800 p-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Einzelfreischaltung</span>
              <h3 className="mt-1 font-bold">Werbeclip</h3>
              <p className="mt-1 text-xs text-neutral-300">Schau ein kurzes Partner-Video zur Freischaltung.</p>
            </div>
            <button
              type="button"
              disabled={isLoadingAd}
              onClick={handleAd}
              className="mt-4 w-full rounded-lg bg-neutral-700 py-2 text-xs font-semibold text-white hover:bg-neutral-600 disabled:opacity-50 transition"
            >
              {isLoadingAd ? 'Wird geladen...' : 'Clip starten'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full text-center text-xs text-neutral-500 hover:text-white transition"
        >
          Später entscheiden
        </button>
      </div>
    </div>
  );
};

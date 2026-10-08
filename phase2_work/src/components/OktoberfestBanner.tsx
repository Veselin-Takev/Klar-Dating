import React from 'react';
import { Sparkles } from 'lucide-react';

interface OktoberfestBannerProps {
  onActivateFilter?: () => void;
}

export const OktoberfestBanner: React.FC<OktoberfestBannerProps> = ({ onActivateFilter }) => {
  return (
    <div className="bg-gradient-to-r from-amber-600/10 via-orange-500/10 to-red-600/10 border border-orange-500/20 rounded-xl p-4 my-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-600 dark:text-orange-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              O’zapft is! 🍻 Wiesn-Special 2026
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              Finde deine Wiesn-Begleitung in München. Aktiviere den Oktoberfest-Filter für exklusive Vorschläge.
            </p>
          </div>
        </div>
        {onActivateFilter && (
          <button
            onClick={onActivateFilter}
            className="text-xs bg-orange-600 hover:bg-orange-700 text-white font-medium px-3 py-1.5 rounded-lg transition shadow-sm"
          >
            Filter aktivieren
          </button>
        )}
      </div>
    </div>
  );
};

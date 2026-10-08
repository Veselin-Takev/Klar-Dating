import React, { memo } from "react";
import type { Profile } from "../data";
import { Star, Info, ChevronRight, Sparkles, Eye, Copy, Check, MessageSquare } from "lucide-react";

interface MemoizedKlarMatchCardProps {
  verbindung: Profile;
  matchScore: number;
  expandedWhy: boolean;
  loadingWhyWeMatch: boolean;
  whyWeMatch: string | undefined;
  intro: string | undefined;
  loadingIntro: boolean;
  copiedIntro: boolean;
  t: (key: string, defaultText: string) => string;
  onProfileClick: (profile: Profile) => void;
  onGenerateWhy: (e: React.MouseEvent, profile: Profile) => void;
  onPreviewIntro: (e: React.MouseEvent, profile: Profile, intro: string) => void;
  onCopyIntro: (e: React.MouseEvent, intro: string, id: string) => void;
  onGenerateIntro: (e: React.MouseEvent, profile: Profile) => void;
}

export const MemoizedKlarMatchCard = memo(function MemoizedKlarMatchCard({
  verbindung,
  matchScore,
  expandedWhy,
  loadingWhyWeMatch,
  whyWeMatch,
  intro,
  loadingIntro,
  copiedIntro,
  t,
  onProfileClick,
  onGenerateWhy,
  onPreviewIntro,
  onCopyIntro,
  onGenerateIntro
}: MemoizedKlarMatchCardProps) {
  return (
    <div
      className="shrink-0 w-64 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow snap-start flex flex-col"
      onClick={() => onProfileClick(verbindung)}
    >
      <div className="h-32 relative bg-stone-200 dark:bg-stone-800 animate-pulse">
        <img src={verbindung.photoUrl} alt={verbindung.name} className="w-full h-full object-cover absolute inset-0" loading="lazy" />
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-400 text-stone-900 text-[10px] font-bold rounded-full shadow-sm flex items-center gap-1">
          <Star size={10} className="fill-current" />
          {matchScore}% Klar-Verbindung
        </div>
        {verbindung.isVerified && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-white/90 dark:bg-stone-900/90 text-stone-700 dark:text-stone-300 rounded text-[9px] font-bold uppercase tracking-wider border border-stone-900 shadow-sm">
            <Star size={10} className="fill-current" />
          </div>
        )}
      </div>
      <div className="p-3 flex items-center gap-3 border-b border-stone-50 dark:border-stone-700/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-stone-900 dark:text-stone-100 truncate">{verbindung.name}, {verbindung.age}</h4>
            <button
              onClick={(e) => onGenerateWhy(e, verbindung)}
              className="p-1 bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-brand dark:hover:text-brand-light rounded-full transition-colors"
              title="Warum wir passen"
            >
              <Info size={14} />
            </button>
          </div>
          <p className="text-xs text-stone-500 truncate">{verbindung.bio}</p>
        </div>
        <div className="shrink-0 text-stone-400">
          <ChevronRight size={18} />
        </div>
      </div>

      {expandedWhy && (
        <div className="px-3 pb-3 pt-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-emerald-500 shrink-0 mt-0.5" />
              {loadingWhyWeMatch ? (
                 <p className="text-xs text-emerald-700 dark:text-emerald-400 ">Analysiere eure Synergien...</p>
              ) : (
                 <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                   {whyWeMatch}
                 </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-3 pb-3 pt-1 border-t border-stone-50 dark:border-stone-700/50 bg-stone-50/50 dark:bg-stone-800/20 mt-auto">
        {intro ? (
          <div className="bg-brand/5 dark:bg-brand-light/5 p-2.5 rounded-lg border border-brand/10 dark:border-brand-light/10 relative group mt-2">
            <p className="text-xs text-stone-700 dark:text-stone-300 italic pr-8 leading-relaxed">
              "{intro}"
            </p>
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <button
                onClick={(e) => onPreviewIntro(e, verbindung, intro)}
                className="p-1.5 bg-white dark:bg-stone-800 rounded-md border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-brand dark:hover:text-brand-light transition-colors shadow-sm"
                title="Vorschau"
              >
                <Eye size={12} />
              </button>
              <button
                onClick={(e) => onCopyIntro(e, intro, verbindung.id)}
                className="p-1.5 bg-white dark:bg-stone-800 rounded-md border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-brand dark:hover:text-brand-light transition-colors shadow-sm"
                title="Kopieren"
              >
                {copiedIntro ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => onGenerateIntro(e, verbindung)}
            disabled={loadingIntro}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 text-xs font-medium text-brand dark:text-brand-light bg-brand/10 dark:bg-brand-light/10 hover:bg-brand/20 dark:hover:bg-brand-light/20 rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingIntro ? (
              <div className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin"></div>
            ) : (
              <MessageSquare size={14} />
            )}
            {loadingIntro ? "Generiere..." : t("dashboard.smartIntro")}
          </button>
        )}
      </div>
    </div>
  );
});

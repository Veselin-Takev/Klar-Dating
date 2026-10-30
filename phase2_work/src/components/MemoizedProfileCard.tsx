import { AuthorizedProfileImage } from './AuthorizedProfileImage';
import { memo } from "react";
import { motion } from "motion/react";
import { X, MessageSquare, Sparkles, MapPin } from "lucide-react";
import type { Profile } from "../data";
import { calculateMatchScore } from "../services/matchScore";

interface MemoizedProfileCardProps {
  profile: Profile;
  walkthroughStep: number;
  aiFilterMode: boolean;
  aiKontaktScores: Record<string, { score: number; reason: string }> | null;
  userInterests: string[];
  onPass: (profile: Profile) => void;
  onNachricht: (profile: Profile) => void;
  onClick: (profile: Profile) => void;
  onNextWalkthroughStep: () => void;
}

export const MemoizedProfileCard = memo(function MemoizedProfileCard({
  profile,
  walkthroughStep,
  aiFilterMode,
  aiKontaktScores,
  userInterests,
  onPass,
  onNachricht,
  onClick,
  onNextWalkthroughStep
}: MemoizedProfileCardProps) {
  const matchScore = (aiFilterMode && aiKontaktScores && aiKontaktScores[profile.id])
    ? aiKontaktScores[profile.id]!.score
    : calculateMatchScore(userInterests, profile.interests);

  const isHighMatch = matchScore >= 90;

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_e, { offset, velocity }) => {
        if (offset.x < -80 || velocity.x < -500) {
          onPass(profile);
        } else if (offset.x > 80 || velocity.x > 500) {
          onNachricht(profile);
        }
      }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, x: 0 }}
      exit={{ scale: 0.95, opacity: 0, x: -100 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`flex-1 flex flex-col bg-white dark:bg-stone-800 rounded-2xl overflow-hidden border cursor-pointer transition-colors ${
        walkthroughStep === 2
          ? "relative z-50 scale-[1.02] shadow-md ring-4 ring-brand/50 border-stone-300 dark:border-stone-700"
          : isHighMatch
            ? "border-yellow-400/50 dark:border-yellow-500/50 shadow-[0_0_25px_-5px_rgba(250,204,21,0.4)] dark:shadow-[0_0_25px_-5px_rgba(234,179,8,0.2)] "
            : "border-stone-300 dark:border-stone-700 "
      }`}
      onClick={() => {
        onClick(profile);
        if (walkthroughStep === 2) {
          onNextWalkthroughStep();
        }
      }}
    >
      <div className="h-[45%] bg-stone-200 dark:bg-stone-800 relative animate-pulse">
        <AuthorizedProfileImage
          src={profile.photoUrl}
          alt={`Foto von ${profile.name}`}
          className="w-full h-full object-cover absolute inset-0"
          style={{ aspectRatio: "1/1" }}
          loading="lazy"
          width={400}
          height={400}
        />
        {isHighMatch && (
          <button
            type="button"
            aria-label="Smart Kontakt Details"
            className="absolute top-4 left-4 z-10"
            onClick={(e) => {
              e.stopPropagation();
              // In this simplified version, clicking the top left just opens profile
              onClick(profile);
            }}
          >
            <div className="bg-yellow-400 text-stone-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>Smart-Verbindung</span>
            </div>
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100">
              {profile.name}, {profile.age}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center text-stone-500 dark:text-stone-400 text-sm">
                <MapPin size={14} className="mr-1 opacity-70" />
                {profile.location}
              </div>
              <span className="text-stone-300 dark:text-stone-600 px-1">•</span>
              <div className="flex items-center text-brand dark:text-brand-light text-sm font-medium">
                {matchScore}% übereinstimmend
              </div>
            </div>
          </div>
          <div className="bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 px-3 py-1 rounded-full text-xs font-medium border border-stone-200 dark:border-stone-600">
            {profile.isVerified ? "Verifiziert" : "Neu"}
          </div>
        </div>

        <p className="text-stone-600 dark:text-stone-300 text-sm mb-4 line-clamp-3 leading-relaxed flex-1 mt-2">
          {profile.bio}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-auto mb-4">
          {profile.interests.slice(0, 3).map((interest) => (
            <span
              key={interest}
              className="px-2.5 py-1 bg-stone-100 dark:bg-stone-700/50 text-stone-600 dark:text-stone-300 rounded-full text-xs font-medium"
            >
              {interest}
            </span>
          ))}
          {profile.interests.length > 3 && (
            <span className="px-2.5 py-1 bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500 rounded-full text-xs font-medium border border-stone-200 dark:border-stone-700">
              +{profile.interests.length - 3}
            </span>
          )}
        </div>

        <div className="flex justify-center gap-6 mt-2 relative z-10 pt-4 border-t border-stone-100 dark:border-stone-800">
          <button
            aria-label="Pass"
            className="w-14 h-14 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-500 rounded-full flex items-center justify-center hover:bg-stone-50 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-stone-300 transition-colors shadow-sm hover:shadow active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              onPass(profile);
            }}
          >
            <X size={24} />
          </button>
          <button
            aria-label="Nachricht senden"
            className="w-14 h-14 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm hover:shadow-md active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              onNachricht(profile);
            }}
          >
            <MessageSquare size={24} className="fill-current" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

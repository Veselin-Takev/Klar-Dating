import { Sparkles, Heart } from 'lucide-react';
import type { Profile } from '../data';
import { calculateMatchScore } from '../services/matchScore';

interface SmartVerbindungCarouselProps {
  profiles: Profile[];
  userInterests: string[];
  onProfileClick: (profile: Profile) => void;
}

export function SmartVerbindungCarousel({ profiles, userInterests, onProfileClick }: SmartVerbindungCarouselProps) {
  const smartMatches = profiles.filter(p => calculateMatchScore(userInterests, p.interests) >= 90);

  if (smartMatches.length === 0) return null;

  return (
    <div className="mb-4 -mx-4 px-4">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="bg-yellow-100 dark:bg-yellow-900/30 p-1.5 rounded-full text-yellow-600 dark:text-yellow-500">
          <Sparkles size={16} className="fill-current" />
        </div>
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Deine Smart-Verbindungen</h3>
        <span className="ml-auto text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 px-2 py-0.5 rounded-full">
          {smartMatches.length} Profile
        </span>
      </div>

      <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-3 pb-2">
        {smartMatches.map(verbindung => {
          const score = calculateMatchScore(userInterests, verbindung.interests);
          return (
            <div
              style={{ aspectRatio: "144/192" }}
              key={verbindung.id}
              onClick={() => onProfileClick(verbindung)}
              className="snap-start shrink-0 w-36 h-48 relative rounded-xl overflow-hidden cursor-pointer group shadow-sm border border-stone-200 dark:border-stone-700"
            >
              <img
                src={verbindung.photoUrl}
                alt={`Foto von ${verbindung.name}`}
                className="w-full h-full object-cover transition-transform duration-500 group-"
                loading="lazy"
                width={144}
                height={192}
              />
              <div className="absolute inset-0  from-black/80 via-black/30 to-transparent"></div>

              <div className="absolute top-2 left-2 bg-yellow-400/90  text-yellow-950 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm">
                <Heart size={10} className="fill-current" />
                {score}%
              </div>

              <div className="absolute bottom-2 left-2 right-2">
                <h4 className="text-white font-medium text-sm leading-tight truncate">{verbindung.name}, {verbindung.age}</h4>
                <p className="text-white/80 text-[10px] truncate">{verbindung.location || 'In deiner Nähe'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

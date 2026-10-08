import { useMemo } from 'react';
import type { Profile } from '../data';
import { Tag } from 'lucide-react';

interface VerbindungInterestsTagCloudWidgetProps {
  verbindungen: Profile[];
}

export function VerbindungInterestsTagCloudWidget({ verbindungen }: VerbindungInterestsTagCloudWidgetProps) {
  const tags = useMemo(() => {
    const counts: Record<string, number> = {};
    verbindungen.forEach(profile => {
      profile.interests.forEach(interest => {
        counts[interest] = (counts[interest] || 0) + 1;
      });
    });

    const entries = Object.entries(counts);
    if (entries.length === 0) return [];

    const maxCount = Math.max(...entries.map(([, count]) => count));
    const minCount = Math.min(...entries.map(([, count]) => count));

    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) // Top 20 interests
      .map(([text, count]) => {
        // Size between 0.75rem and 1.5rem
        const sizeRatio = maxCount > minCount ? (count - minCount) / (maxCount - minCount) : 0.5;
        const fontSize = 0.75 + sizeRatio * 0.75;
        // Opacity based on count
        const opacity = 0.5 + sizeRatio * 0.5;

        return {
          text,
          count,
          fontSize: `${fontSize}rem`,
          opacity
        };
      });
  }, [verbindungen]);

  if (tags.length === 0) return null;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 dark:bg-brand-light/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

      <div className="flex items-center gap-2 mb-3 z-10">
        <Tag size={16} className="text-brand dark:text-brand-light" />
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
          Interessen deiner Verbindungen (30 Tage)
        </h3>
      </div>

      <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 z-10 font-medium">
        Verbindungsqualität auf einen Blick: Diese Themen verbinden euch am häufigsten.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-2 z-10">
        {tags.map((tag, index) => (
          <span
            key={index}
            style={{ fontSize: tag.fontSize, opacity: tag.opacity }}
            className="font-medium text-stone-700 dark:text-stone-300 transition-colors hover:text-brand dark:hover:text-brand-light cursor-default"
            title={`${tag.text} (${tag.count}x)`}
          >
            {tag.text}
          </span>
        ))}
      </div>
    </div>
  );
}

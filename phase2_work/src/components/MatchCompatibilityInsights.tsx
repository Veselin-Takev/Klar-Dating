import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';

type MatchCompatibilityInsightsProps = {
  userInterests: string[];
  profileInterests: string[];
  profileName: string;
};

// A helper function to categorize interests to approximate "Lifestyle", "Professional", "Hobbies"
const categorizeInterests = (interests: string[]) => {
  const categories = {
    Lifestyle: 0,
    Professional: 0,
    Hobbies: 0
  };

  const lowerInterests = interests.map(i => i.toLowerCase());

  lowerInterests.forEach(i => {
    if (['fitness', 'gesundheit', 'reisen', 'vegan', 'yoga', 'kaffee'].some(k => i.includes(k))) {
      categories.Lifestyle += 1;
    } else if (['karriere', 'startup', 'finanzen', 'technologie', 'bildung', 'lernen'].some(k => i.includes(k))) {
      categories.Professional += 1;
    } else {
      categories.Hobbies += 1;
    }
  });

  return categories;
};

export function MatchCompatibilityInsights({ userInterests, profileInterests, profileName }: MatchCompatibilityInsightsProps) {
  const { chartData, sharedDetails } = useMemo(() => {
    const userCategories = categorizeInterests(userInterests);
    const profileCategories = categorizeInterests(profileInterests);

    // Find common interests
    const common = userInterests.filter(i => profileInterests.includes(i));
    const commonCat = categorizeInterests(common);

    // Group shared interests back into categories for display
    const sharedDetails = {
      Lifestyle: common.filter(i => ['fitness', 'gesundheit', 'reisen', 'vegan', 'yoga', 'kaffee'].some(k => i.toLowerCase().includes(k))),
      Professional: common.filter(i => ['karriere', 'startup', 'finanzen', 'technologie', 'bildung', 'lernen'].some(k => i.toLowerCase().includes(k))),
      Hobbies: common.filter(i => !['fitness', 'gesundheit', 'reisen', 'vegan', 'yoga', 'kaffee', 'karriere', 'startup', 'finanzen', 'technologie', 'bildung', 'lernen'].some(k => i.toLowerCase().includes(k)))
    };

    const calculateCategoryScore = (categoryName: string) => {
      const uCount = userCategories[categoryName as keyof typeof userCategories] || 0;
      const pCount = profileCategories[categoryName as keyof typeof profileCategories] || 0;
      const cCount = commonCat[categoryName as keyof typeof commonCat] || 0;

      // Base score 40, plus up to 60 for shared
      let score = 40;
      if (uCount > 0 && pCount > 0) score += 20; // both have some interest in this category
      score += (cCount * 20);

      return Math.min(100, score);
    };

    return {
      chartData: [
        {
          subject: 'Lifestyle',
          A: calculateCategoryScore('Lifestyle'),
          fullMark: 100,
        },
        {
          subject: 'Hobbies',
          A: calculateCategoryScore('Hobbies'),
          fullMark: 100,
        },
        {
          subject: 'Professional',
          A: calculateCategoryScore('Professional'),
          fullMark: 100,
        }
      ],
      sharedDetails
    };
  }, [userInterests, profileInterests]);

  return (
    <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4 mt-4 border border-stone-200 dark:border-stone-700">
      <div className="flex flex-col gap-1 mb-3">
        <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Sparkles size={16} className="text-brand dark:text-brand-light" />
          KI-Vibe-Analyse
        </h3>
        <p className="text-[10px] text-stone-500 uppercase tracking-wide font-bold">KI-basierter Präferenz-Abgleich</p>
      </div>

      <div className="h-48 w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
            <PolarGrid stroke="currentColor" className="text-stone-200 dark:text-stone-800" />
            <PolarAngleAxis className="text-stone-500 dark:text-stone-400" dataKey="subject" tick={{ fill: '#78716c', fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={profileName}
              dataKey="A"
              stroke="#E05B46" // brand color
              fill="#E05B46"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-2 text-xs text-stone-600 dark:text-stone-400">
        {sharedDetails.Lifestyle.length > 0 && (
          <p><strong className="text-stone-700 dark:text-stone-300">Lifestyle:</strong> Ihr teilt Werte wie {sharedDetails.Lifestyle.join(', ')}.</p>
        )}
        {sharedDetails.Professional.length > 0 && (
          <p><strong className="text-stone-700 dark:text-stone-300">Professional:</strong> Gemeinsame Ziele in {sharedDetails.Professional.join(', ')}.</p>
        )}
        {sharedDetails.Hobbies.length > 0 && (
          <p><strong className="text-stone-700 dark:text-stone-300">Hobbies:</strong> Ihr mögt beide {sharedDetails.Hobbies.join(', ')}.</p>
        )}
        {Object.values(sharedDetails).every(arr => arr.length === 0) && (
          <p>Einige Gemeinsamkeiten sind vorhanden. Findet im Chat mehr heraus.</p>
        )}
      </div>
    </div>
  );
}

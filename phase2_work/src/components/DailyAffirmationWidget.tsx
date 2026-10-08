import { useState, useEffect } from 'react';
import { getUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { Sunrise } from 'lucide-react';
import { askAICoach } from '../lib/api';

export function DailyAffirmationWidget() {
  const [affirmation, setAffirmation] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAffirmation = async () => {
      const savedDate = klarStorage.getItem('klar_affirmation_date');
      const savedAffirmation = klarStorage.getItem('klar_daily_affirmation');
      const today = new Date().toDateString();

      if (savedDate === today && savedAffirmation) {
        setAffirmation(savedAffirmation);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const savedInterests = getUserStorageItem('userInterests');
        const interests = savedInterests ? JSON.parse(savedInterests).join(", ") : "Allgemeine Themen";

        const prompt = `Erstelle einen kurzen (1-2 Sätze), motivierenden Tipp oder eine Affirmation für den Start in den Tag, um das Selbstvertrauen beim Dating zu stärken. Berücksichtige dabei (falls passend) folgende Interessen des Nutzers: ${interests}. Formuliere es positiv, warmherzig und nicht zu kitschig.`;

        const response = await askAICoach(prompt);
        const cleanResponse = response.trim();
        setAffirmation(cleanResponse);
        klarStorage.setItem('klar_affirmation_date', today);
        klarStorage.setItem('klar_daily_affirmation', cleanResponse);
      } catch (e) {
        console.warn("Failed to fetch affirmation", e);
        // Fallback
        setAffirmation("Du bist großartig, genau so wie du bist. Gehe heute mit einem Lächeln auf andere zu!");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAffirmation();
  }, []);

  return (
    <div className=" from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-800/50 rounded-2xl p-4 shadow-sm relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-400/10 dark:bg-amber-400/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center gap-2 mb-2 relative z-10">
        <Sunrise size={18} className="text-amber-500 dark:text-amber-400" />
        <h3 className="font-medium text-amber-900 dark:text-amber-100 text-sm">Dein Start in den Tag</h3>
      </div>

      <div className="relative z-10 min-h-[3rem] flex items-center">
        {isLoading ? (
          <div className="flex items-center gap-2 text-amber-700/60 dark:text-amber-300/60 text-sm">
            <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700  mb-3"></div>
            <span>Bereite Affirmation vor...</span>
          </div>
        ) : (
          <p className="text-sm text-amber-800 dark:text-amber-200/90 font-medium leading-relaxed italic">
            "{affirmation}"
          </p>
        )}
      </div>
    </div>
  );
}

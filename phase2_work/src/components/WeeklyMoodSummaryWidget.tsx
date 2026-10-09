import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, BrainCircuit } from 'lucide-react';
import { melde } from "../lib/fehler";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type MoodRecord = Record<string, unknown>;
type MoodPoint = { dateStr: string; shortLabel: string; moodScore: number; count: number };

function parseRecords(raw: string | null): MoodRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is MoodRecord => !!value && typeof value === 'object' && !Array.isArray(value))
      : [];
  } catch {
    return [];
  }
}

export function WeeklyMoodSummaryWidget() {
  const [data, setData] = useState<MoodPoint[]>([]);
  const [hasEntries, setHasEntries] = useState(false);

  useEffect(() => {
    async function loadMoodData() {
      try {
        // Aggregate from reflection logs and local date reflections
        const savedLogs = klarStorage.getItem('klar_reflection_logs');
        const savedReflections = klarStorage.getItem('klar_date_reflections');
        const logs = parseRecords(savedLogs);
        const reflections = parseRecords(savedReflections);

        let firestoreMoods: MoodRecord[] = [];
        if (auth.currentUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists() && Array.isArray(userDoc.data().moodHistory)) {
              const rawHistory: unknown = userDoc.data().moodHistory;
              firestoreMoods = Array.isArray(rawHistory) ? rawHistory.filter((value): value is MoodRecord => !!value && typeof value === 'object' && !Array.isArray(value)) : [];
            }
          } catch {
            // offline fallback
          }
        }

        // Create 7 days template
        const last7Days = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            dateStr: d.toLocaleDateString('de-DE'),
            shortLabel: d.toLocaleDateString('de-DE', { weekday: 'short' }),
            moodScore: 0,
            count: 0
          };
        });

        let totalCount = 0;

        logs.forEach((log) => {
          const rawDate = log.date;
          if (typeof rawDate !== 'string' && typeof rawDate !== 'number') return;
          const dateStr = new Date(rawDate).toLocaleDateString('de-DE');
          const day = last7Days.find(d => d.dateStr === dateStr);
          if (day) {
            day.count++;
            totalCount++;
            if (log.mood === 'good') day.moodScore += 1;
            else if (log.mood === 'bad') day.moodScore -= 1;
          }
        });

        reflections.forEach((ref) => {
          const rawDate = ref.date;
          if (typeof rawDate !== 'string' && typeof rawDate !== 'number') return;
          const dateStr = new Date(rawDate).toLocaleDateString('de-DE');
          const day = last7Days.find(d => d.dateStr === dateStr);
          if (day) {
            day.count++;
            totalCount++;
            const rating = typeof ref.rating === 'number' ? ref.rating : Number(ref.rating);
            if (rating >= 4) day.moodScore += 1;
            else if (rating <= 2) day.moodScore -= 1;
          }
        });

        firestoreMoods.forEach((m) => {
          const rawDate = m.date;
          if (typeof rawDate !== 'string' && typeof rawDate !== 'number') return;
          const dateStr = new Date(rawDate).toLocaleDateString('de-DE');
          const day = last7Days.find(d => d.dateStr === dateStr);
          if (day) {
            day.count++;
            totalCount++;
            const score = typeof m.score === 'number' ? m.score : Number(m.score);
            if (score > 0) day.moodScore += 1;
            else if (score < 0) day.moodScore -= 1;
          }
        });

        last7Days.forEach(day => {
          if (day.count > 0) {
            day.moodScore = day.moodScore / day.count; // Average between -1 and 1
          }
        });

        setData(last7Days);
        setHasEntries(totalCount > 0);
      } catch (e) {
        melde("WeeklyMoodSummaryWidget", e);
        setData([]);
        setHasEntries(false);
      }
    }

    loadMoodData();
  }, []);

  const avgMood = data.length && hasEntries ? data.reduce((acc, curr) => acc + curr.moodScore, 0) / data.length : 0;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100">Wochen-Resümee</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Deine Date-Stimmung</p>
        </div>
      </div>

      {hasEntries ? (
        <div className="h-40 w-full mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="shortLabel" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{fill: 'rgba(0,0,0,0.05)'}}
                formatter={(value: unknown) => {
                    const numericValue = typeof value === 'number' ? value : Number(value);
                    if (numericValue > 0.3) return ['Gut', 'Stimmung'];
                    if (numericValue < -0.3) return ['Schlecht', 'Stimmung'];
                    return ['Neutral', 'Stimmung'];
                }}
              />
              <Bar dataKey="moodScore" fill="#a855f7" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-8 px-4 text-center bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700 mb-4">
          <BrainCircuit size={28} className="mx-auto mb-2 text-stone-400 opacity-60" />
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Noch keine Date-Stimmungen erfasst</p>
          <p className="text-xs mt-1 text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
            Halte deine Gefühle nach Verabredungen fest, um deinen authentischen 7-Tage-Verlauf zu sehen.
          </p>
        </div>
      )}

      {hasEntries && avgMood < -0.2 && (
        <div className="flex items-start gap-2 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-800/30">
          <BrainCircuit size={16} className="text-purple-600 mt-0.5 shrink-0" />
          <p className="text-xs text-stone-700 dark:text-stone-300">
            <strong>AI-Coach Tipp:</strong> Dein Stimmungstrend ist leicht negativ. Gönn dir eine Pause vom Dating und lade deine Batterien wieder auf.
          </p>
        </div>
      )}
    </div>
  );
}

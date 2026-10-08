import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Flame, Award, CalendarCheck, Share2 } from 'lucide-react';
import { toPng } from 'html-to-image';

export const WeeklyConsistencyTracker: React.FC = () => {
  const [streak, setStreak] = useState(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (!badgeRef.current) return;
    try {
      const dataUrl = await toPng(badgeRef.current, {
        cacheBust: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1c1917' : '#ffffff'
      });
      const link = document.createElement('a');
      link.download = 'klar-consistency-badge.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
    }
  };

  useEffect(() => {
    // Load check-in data from klarStorage
    const savedData = klarStorage.getItem('klar_consistency_streak');
    if (savedData) {
      try {
        const { lastCheckIn, currentStreak } = JSON.parse(savedData);

        // Check if last check-in was today or yesterday
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (lastCheckIn === today) {
          setHasCheckedInToday(true);
          setStreak(currentStreak);
          if (currentStreak >= 7) {
            setShowReward(true);
          }
        } else if (lastCheckIn === yesterday) {
          setStreak(currentStreak);
        } else {
          // Streak broken
          setStreak(0);
        }
      } catch (e) {
        console.error("Error parsing streak data", e);
      }
    }
  }, []);

  const handleCheckIn = () => {
    const today = new Date().toDateString();
    const newStreak = streak + 1;

    setStreak(newStreak);
    setHasCheckedInToday(true);

    if (newStreak >= 7) {
      setShowReward(true);
    }

    klarStorage.setItem('klar_consistency_streak', JSON.stringify({
      lastCheckIn: today,
      currentStreak: newStreak
    }));
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <CalendarCheck className="text-brand dark:text-brand-light" size={20} />
          Weekly Consistency
        </h3>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium">
          <Flame size={16} className={streak > 0 ? "fill-orange-500" : ""} />
          {streak} Days
        </div>
      </div>

      <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
        Check in daily to build your dating consistency. 7 days unlocks a special badge!
      </p>

      <div className="flex justify-between items-center mb-6">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <div
            key={day}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
              ${day <= streak
                ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
              }`}
          >
            {day <= streak ? <CheckCircle2 size={16} /> : day}
          </div>
        ))}
      </div>

      {showReward ? (
        <div className="flex flex-col gap-3">
          <div
            ref={badgeRef}
            className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 flex items-center gap-4 border border-yellow-100 dark:border-yellow-900/30"
          >
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center shrink-0">
              <Award className="text-yellow-600 dark:text-yellow-400" size={24} />
            </div>
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Consistency Badge Unlocked!</h4>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                You've checked in for 7 consecutive days. Keep up the great momentum!
              </p>
            </div>
          </div>
          <button
            onClick={handleShare}
            className="w-full py-2.5 rounded-2xl font-medium transition-all bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 hover:bg-opacity-90 active:bg-opacity-80 flex items-center justify-center gap-2 text-sm border border-yellow-200 dark:border-yellow-900/50"
          >
            <Share2 size={16} />
            Share Badge
          </button>
        </div>
      ) : (
        <button
          onClick={handleCheckIn}
          disabled={hasCheckedInToday}
          className={`w-full py-3 rounded-2xl font-medium transition-all ${
            hasCheckedInToday
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed'
              : 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:bg-opacity-90 active:bg-opacity-80'
          }`}
        >
          {hasCheckedInToday ? "Checked in for today" : "Check in today"}
        </button>
      )}
    </div>
  );
};

import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import type { UserMusicPreferences } from '../types/user';

interface OnboardingMusicProps {
  headingId?: string;
  initialPreferences?: UserMusicPreferences;
  onComplete: (preferences: UserMusicPreferences) => void;
  onBack: () => void;
}

const AVAILABLE_GENRES = [
  'Rock', 'Pop', 'Jazz', 'Techno', 'Hip-Hop',
  'Klassik', 'Indie', 'Metal', 'Electronic', 'Soul'
] as const;

export const OnboardingMusic: React.FC<OnboardingMusicProps> = ({
  headingId = 'onboarding-music-heading',
  initialPreferences = { genres: [], concertGoer: false, playingInstrument: false },
  onComplete,
  onBack,
}) => {
  const { t } = useTranslation();
  const [genres, setGenres] = useState<string[]>(initialPreferences.genres || []);
  const [concertGoer, setConcertGoer] = useState<boolean>(initialPreferences.concertGoer || false);
  const [playingInstrument, setPlayingInstrument] = useState<boolean>(initialPreferences.playingInstrument || false);

  const toggleGenre = (genre: string) => {
    setGenres(current =>
      current.includes(genre) ? current.filter(item => item !== genre) : [...current, genre]
    );
  };

  const handleNext = () => {
    onComplete({ genres, concertGoer, playingInstrument });
  };

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby="onboarding-music-description"
      className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full mx-auto"
    >
      <h1 id={headingId} data-step-heading tabIndex={-1} className="text-2xl font-bold text-gray-900 mb-2">
        {t('musicOnboarding.title')}
      </h1>
      <p id="onboarding-music-description" className="text-gray-600 mb-6">
        {t('musicOnboarding.intro')}
      </p>

      <fieldset className="mb-6" aria-describedby="onboarding-music-description">
        <legend className="block text-sm font-medium text-gray-700 mb-3">
          {t('musicOnboarding.genresLabel')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_GENRES.map((genre) => {
            const isSelected = genres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                data-testid={`genre-${genre.toLowerCase()}`}
                onClick={() => toggleGenre(genre)}
                aria-pressed={isSelected}
                className={`min-h-11 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t(`musicOnboarding.genres.${genre}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-4 mb-8">
        <legend className="sr-only">{t('musicOnboarding.more')}</legend>
        <div className="flex items-center gap-3">
          <input
            id="music-concert-goer"
            type="checkbox"
            checked={concertGoer}
            onChange={(event) => setConcertGoer(event.target.checked)}
            className="w-6 h-6 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
          />
          <label htmlFor="music-concert-goer" className="text-gray-700 font-medium cursor-pointer">
            {t('musicOnboarding.concerts')}
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="music-playing-instrument"
            type="checkbox"
            checked={playingInstrument}
            onChange={(event) => setPlayingInstrument(event.target.checked)}
            className="w-6 h-6 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
          />
          <label htmlFor="music-playing-instrument" className="text-gray-700 font-medium cursor-pointer">
            {t('musicOnboarding.instrument')}
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap justify-between items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          {t('musicOnboarding.back')}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="min-h-11 px-6 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all"
        >
          {t('musicOnboarding.next')}
        </button>
      </div>
    </section>
  );
};


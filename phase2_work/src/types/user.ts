export type UserInterest = 'Vegan' | 'Oktoberfest' | 'Kochen' | 'Sport' | 'Kultur' | 'Reisen' | 'Musik';

export interface UserMusicPreferences {
  genres: string[];
  concertGoer: boolean;
  playingInstrument: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  interests: UserInterest[];
  musicPreferences?: UserMusicPreferences;
}

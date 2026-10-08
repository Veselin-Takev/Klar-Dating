import type { UserProfile, UserMusicPreferences } from '../types/user';

const normalizeGenre = (genre: string) => genre.trim().toLocaleLowerCase('de-DE');

/**
 * Validates music preferences according to the strict Firestore security rules contract:
 * - Must be an object with keys: genres, concertGoer, playingInstrument
 * - genres must be an array of strings with at most 20 elements
 * - concertGoer must be a boolean
 * - playingInstrument must be a boolean
 */
export function validateMusicPreferences(data: unknown): data is UserMusicPreferences {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.genres) || obj.genres.length > 20) return false;
  if (!obj.genres.every(g => typeof g === 'string' && g.trim().length > 0)) return false;
  if (typeof obj.concertGoer !== 'boolean') return false;
  if (typeof obj.playingInstrument !== 'boolean') return false;
  return true;
}

export interface MusicCoachReport {
  resonanceScore: number;
  sharedGenres: string[];
  concertAffinity: boolean;
  jamPotential: boolean;
  coachInsight: string;
  recommendedDate: string;
  conversationStarters: string[];
}

export interface UserProfileLike {
  uid?: string;
  name?: string;
  interests?: string[];
  musicPreferences?: {
    genres?: string[];
    concertGoer?: boolean;
    playingInstrument?: boolean;
  };
  [key: string]: unknown;
}

/**
 * Generates an end-to-end Music Coach assessment delivering contextual icebreakers,
 * date ideas, and compatibility insights between two profiles.
 */
export function evaluateMusicCoachContract(userA: UserProfile | UserProfileLike, userB: UserProfile | UserProfileLike): MusicCoachReport {
  const musicA = userA.musicPreferences;
  const musicB = userB.musicPreferences;

  const genresA = musicA?.genres || [];
  const genresB = musicB?.genres || [];

  const setB = new Set(genresB.map(normalizeGenre));
  const sharedGenres = genresA.filter(g => setB.has(normalizeGenre(g)));

  const concertAffinity = Boolean(musicA?.concertGoer && musicB?.concertGoer);
  const jamPotential = Boolean(musicA?.playingInstrument && musicB?.playingInstrument);

  let score = 0;
  const totalGenresCount = new Set([...genresA.map(normalizeGenre), ...genresB.map(normalizeGenre)]).size;
  if (totalGenresCount > 0) {
    score += Math.round((sharedGenres.length / totalGenresCount) * 50);
  }
  if (concertAffinity) score += 30;
  if (jamPotential) score += 20;

  let coachInsight = 'Musik ist ein wunderbarer Gesprächseinstieg.';
  let recommendedDate = 'Gemütliches Café mit Hintergrund-Musik in Schwabing';
  const conversationStarters: string[] = [];

  if (sharedGenres.length > 0) {
    coachInsight = `Große Übereinstimmung bei ${sharedGenres.join(' und ')}! Eure musikalischen Wellenlängen harmonieren hervorragend.`;
    conversationStarters.push(`Was war das beste ${sharedGenres[0]}-Konzert oder Album, das du je erlebt hast?`);
  }

  if (concertAffinity) {
    recommendedDate = 'Live-Konzert im Muffatwerk oder Jazzclub Unterfahrt München';
    conversationStarters.push('Welches Live-Konzert oder Festival steht dieses Jahr ganz oben auf deiner Wunschliste?');
  } else if (jamPotential) {
    recommendedDate = 'Acoustic Jam Session oder Besuch in einem Musikcafé';
    conversationStarters.push('Welches Instrument spielst du am liebsten, und improvisierst du gerne?');
  }

  if (conversationStarters.length === 0) {
    const bothLikeMusic = (userA.interests || []).includes('Musik') && (userB.interests || []).includes('Musik');
    if (bothLikeMusic) {
      conversationStarters.push('Welcher Song läuft bei dir aktuell in Dauerschleife?');
    } else {
      conversationStarters.push('Welcher Soundtrack beschreibt deine aktuelle Lebensphase am besten?');
    }
  }

  return {
    resonanceScore: Math.min(100, Math.max(0, score)),
    sharedGenres,
    concertAffinity,
    jamPotential,
    coachInsight,
    recommendedDate,
    conversationStarters,
  };
}

export function generateMusicIcebreaker(userA: UserProfile | UserProfileLike, userB: UserProfile | UserProfileLike): string {
  const report = evaluateMusicCoachContract(userA, userB);
  if (report.conversationStarters.length > 0) {
    if (report.sharedGenres.length > 0) {
      return `Ihr teilt beide eine Begeisterung für ${report.sharedGenres.join(', ')}! Wie wäre es mit einer Frage zu eurem letzten Konzertbesuch?`;
    }
    const firstStarter = report.conversationStarters[0];
    if (firstStarter) {
      return firstStarter;
    }
  }

  const bothLikeMusic = (userA.interests || []).includes('Musik') && (userB.interests || []).includes('Musik');
  if (bothLikeMusic) {
    return 'Ihr beide habt Musik in euren Interessen angegeben. Welcher Song läuft bei euch aktuell im Loop?';
  }

  return 'Welche Musik sorgt bei dir sofort für gute Stimmung?';
}

export function suggestMunichDate(_user?: unknown): string {
  return 'Englischer Garten Spaziergang mit Café in Schwabing';
}

export function generateIcebreaker(_userA?: unknown, _userB?: unknown): string {
  return 'Hallo! Was ist dein Lieblingsort in München?';
}

export default {
  validateMusicPreferences,
  evaluateMusicCoachContract,
  generateMusicIcebreaker,
  suggestMunichDate,
  generateIcebreaker,
};

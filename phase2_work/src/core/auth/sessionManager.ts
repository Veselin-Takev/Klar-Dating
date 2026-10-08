import { klarStorage } from '../../lib/userScopedStorage';
export interface UserSession {
  uid: string;
  email: string | null;
  token: string;
  isVerified: boolean;
}

export class SessionManager {
  private static STORAGE_KEY = 'klar_user_session';

  public static saveSession(session: UserSession): void {
    if (typeof window !== 'undefined') {
      klarStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    }
  }

  public static getSession(): UserSession | null {
    if (typeof window === 'undefined') return null;
    const data = klarStorage.getItem(this.STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as UserSession;
    } catch {
      return null;
    }
  }

  public static clearSession(): void {
    if (typeof window !== 'undefined') {
      klarStorage.removeItem(this.STORAGE_KEY);
    }
  }
}

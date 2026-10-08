import { istPauseLautPlan, type Pausenplan } from '../../lib/pausenplan';

export interface SessionMindfulnessInput {
  sessionDurationMinutes: number;
  rapidRejectionsInWindow: number; // Rejections within the last 3-5 minutes
  totalProfilesViewedInSession?: number;
  pauseSchedule?: Pausenplan | null;
  currentDate?: Date;
}

export type MindfulnessState = 'healthy' | 'fatigue_warning' | 'break_recommended' | 'scheduled_pause';

export interface SessionMindfulnessResult {
  state: MindfulnessState;
  fatigueScore: number; // 0 - 100
  isBreakRecommended: boolean;
  recommendedBreakMinutes?: number;
  message?: string;
  reflectionPrompt?: string;
}

export function calculateFatigueScore(sessionMinutes: number, rapidRejections: number): number {
  const timeComponent = Math.min(60, (sessionMinutes / 45) * 60);
  const rejectionComponent = Math.min(40, (rapidRejections / 15) * 40);
  return Math.min(100, Math.round(timeComponent + rejectionComponent));
}

export function evaluateSessionMindfulness(input: SessionMindfulnessInput): SessionMindfulnessResult {
  const now = input.currentDate ?? new Date();
  const sessionMinutes = Math.max(0, input.sessionDurationMinutes);
  const rapidRejections = Math.max(0, input.rapidRejectionsInWindow);

  // Check scheduled digital pause
  if (input.pauseSchedule && Array.isArray(input.pauseSchedule)) {
    const jsDay = now.getDay();
    const hour = now.getHours();
    if (istPauseLautPlan(input.pauseSchedule, jsDay, hour)) {
      return {
        state: 'scheduled_pause',
        fatigueScore: 100,
        isBreakRecommended: true,
        recommendedBreakMinutes: 60,
        message: 'Geplante Auszeit aktiv: Dein Pausenplan schützt deine persönliche Offline-Zeit.',
        reflectionPrompt: 'Nutze die Zeit für dich oder reale Begegnungen.',
      };
    }
  }

  const fatigueScore = calculateFatigueScore(sessionMinutes, rapidRejections);

  // Rapid rejection pattern (Dopamine / Decision fatigue)
  if (rapidRejections >= 15) {
    return {
      state: 'fatigue_warning',
      fatigueScore,
      isBreakRecommended: true,
      recommendedBreakMinutes: 15,
      message: 'Achtsamkeits-Hinweis: Du entscheidest gerade sehr schnell. Gönn dir einen Moment zum Durchatmen.',
      reflectionPrompt: 'Welche Werte und Eigenschaften sind dir bei einem Gegenüber heute am wichtigsten?',
    };
  }

  // Session duration threshold (Prolonged screen time)
  if (sessionMinutes >= 45) {
    return {
      state: 'break_recommended',
      fatigueScore,
      isBreakRecommended: true,
      recommendedBreakMinutes: 30,
      message: 'Schon über 45 Minuten aktiv: Zeit für eine Pause. Gute Gespräche entstehen mit klarem Kopf.',
      reflectionPrompt: 'Nimm dir Zeit, die bisherigen Matches in Ruhe kennenzulernen.',
    };
  }

  return {
    state: 'healthy',
    fatigueScore,
    isBreakRecommended: false,
    message: undefined,
    reflectionPrompt: undefined,
  };
}

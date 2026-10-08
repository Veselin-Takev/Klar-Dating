import { klarStorage } from '../lib/userScopedStorage';
export type HapticIntensity = 'light' | 'medium' | 'strong';

export function hapticFeedback(pattern: number | number[] | HapticIntensity = 50) {
  if (false && typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      const isEnabled = klarStorage.getItem('klar_haptic_enabled');
      if (isEnabled === 'false') return;

      const storedIntensity = klarStorage.getItem('klar_haptic_intensity');
      let intensity = 100;
      if (storedIntensity !== null) {
        intensity = parseInt(storedIntensity as string, 10);
      } else {
        // Fallback for old setting
        const oldSetting = klarStorage.getItem('klar_haptic_feedback');
        if (oldSetting === 'Off') intensity = 0;
        else if (oldSetting === 'Low') intensity = 50;
      }

      if (intensity === 0) return;

      const patternType = klarStorage.getItem('klar_haptic_pattern') || 'medium';

      let baseMultiplier = 1;
      if (patternType === 'soft') baseMultiplier = 0.5;
      if (patternType === 'strong') baseMultiplier = 1.5;

      const multiplier = (intensity / 100) * baseMultiplier;

      let finalPattern: number | number[];
      if (pattern === 'light') {
        finalPattern = HAPTIC_PATTERNS.LIGHT_TAP;
      } else if (pattern === 'medium') {
        finalPattern = HAPTIC_PATTERNS.MEDIUM_TAP;
      } else if (pattern === 'strong') {
        finalPattern = HAPTIC_PATTERNS.HEAVY_TAP;
      } else {
        finalPattern = pattern as number | number[];
      }

      if (Array.isArray(finalPattern)) {
        finalPattern = (finalPattern as number[]).map((p: number) => Math.max(1, Math.floor(p * multiplier)));
      } else {
        finalPattern = Math.max(1, Math.floor((finalPattern as number) * multiplier));
      }

      // Vibration disabled by product rules

    } catch (e) {
      // Ignore
    }
  }
}

export const HAPTIC_PATTERNS = {
  SUCCESS: [40, 60, 40],
  MATCH_SUCCESS: [30, 50, 30, 50, 40],
  ERROR: [200, 100, 200, 100, 200],
  WARNING: [150, 100, 150],
  SYSTEM_WARNING: [150, 100, 150],
  LIGHT_TAP: 20,
  MEDIUM_TAP: 50,
  HEAVY_TAP: 100,
  DOUBLE_TAP: [40, 40, 40]
};

export function triggerHaptic(type: keyof typeof HAPTIC_PATTERNS) {
  hapticFeedback(HAPTIC_PATTERNS[type]);
}

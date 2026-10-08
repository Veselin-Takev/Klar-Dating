import type { SupportedLanguage } from './locale';
const locales = { de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR' } as const;
const finite = (value: number) => { if (!Number.isFinite(value)) throw new RangeError('A finite value is required'); return value; };
export function formatMoney(minorUnits: number, currency: string, language: SupportedLanguage) {
  if (!Number.isSafeInteger(minorUnits)) throw new RangeError('Money must use integer minor units');
  const formatter = new Intl.NumberFormat(locales[language], { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minorUnits / 10 ** digits);
}
export function formatCoins(value: number, language: SupportedLanguage) {
  return new Intl.NumberFormat(locales[language], { maximumFractionDigits: 0 }).format(finite(value));
}
export function formatDistance(km: number, language: SupportedLanguage, unit: 'km' | 'mile' = 'km') {
  if (finite(km) < 0) throw new RangeError('Distance must not be negative');
  return new Intl.NumberFormat(locales[language], { style: 'unit', unit: unit === 'km' ? 'kilometer' : 'mile', unitDisplay: 'short', maximumFractionDigits: 1 }).format(unit === 'mile' ? km / 1.609344 : km);
}
export function formatRelativeTime(timestamp: number, now: number, language: SupportedLanguage) {
  const seconds = (finite(timestamp) - finite(now)) / 1000;
  const absolute = Math.abs(seconds);
  const [unit, divisor]: [Intl.RelativeTimeFormatUnit, number] = absolute < 60 ? ['second', 1] : absolute < 3600 ? ['minute', 60] : absolute < 86400 ? ['hour', 3600] : absolute < 2592000 ? ['day', 86400] : absolute < 31536000 ? ['month', 2592000] : ['year', 31536000];
  return new Intl.RelativeTimeFormat(locales[language], { numeric: 'auto', style: 'short' }).format(Math.round(seconds / divisor), unit);
}
export function formatDate(timestamp: number, language: SupportedLanguage, timeZone: string) {
  return new Intl.DateTimeFormat(locales[language], { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(finite(timestamp));
}

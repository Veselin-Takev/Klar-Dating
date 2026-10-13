/** UI-only display name resolution. Never persist an email-derived label as a public profile name. */
export function resolveProfileDisplayName(
  storedName: unknown,
  authName: string | null | undefined,
  email: string | null | undefined,
  emailVerified: boolean,
): string {
  const clean = (value: unknown): string => typeof value === 'string' ? value.trim().slice(0, 80) : '';
  const stored = clean(storedName);
  if (stored && stored.toLocaleLowerCase() !== 'neu') return stored;
  const verifiedAuthName = clean(authName);
  if (verifiedAuthName) return verifiedAuthName;
  if (emailVerified && email) {
    const prefix = email.split('@')[0]?.trim().replace(/[._-]+/g, ' ') ?? '';
    if (prefix) return prefix.slice(0, 80);
  }
  return 'Namen im Profil ergänzen';
}

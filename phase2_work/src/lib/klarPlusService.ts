export interface UserSubscription {
  userId: string;
  isKlarPlus: boolean;
  expiresAt?: string;
}

export function canAccessAdvancedFilter(user: UserSubscription, filterName: string): boolean {
  const premiumOnlyFilters = ['Oktoberfest', 'Vegan'];
  
  if (premiumOnlyFilters.includes(filterName)) {
    return user.isKlarPlus;
  }
  return true; // Standardfilter sind für alle frei
}

export function getMatchingPriorityBoost(user: UserSubscription): number {
  // Klar Plus Nutzer erhalten einen Prioritäts-Boost im Matching-Algorithmus
  return user.isKlarPlus ? 1.5 : 1.0;
}

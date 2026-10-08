export interface MatchProfile {
  id: string;
  name: string;
  matchScore: number;
  interests: string[];
}

export async function fetchMatchesSafe(): Promise<{ profiles: MatchProfile[]; isOfflineFallback: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('/api/matches', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server antwortete mit Status ${response.status}`);
    }

    const data = await response.json();
    return { profiles: Array.isArray(data.profiles) ? data.profiles : [], isOfflineFallback: false };
  } catch (error) {
    console.warn("Netzwerkfehler oder API-Ausfall beim Matching. liefere keine synthetischen Profile aus:", error);
    return { profiles: [], isOfflineFallback: true };
  }
}

import { auth } from './firebase';
import { melde } from "../lib/fehler";
import { sollWiederholen } from "./wiederholung";

export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}


const CACHE_EXPIRY_MS = 15 * 60 * 1000;
const MAX_MEMORY_CACHE_ENTRIES = 50;

type ApiMemoryCacheEntry = {
  timestamp: number;
  data: unknown;
};

// Personalized API responses must never be persisted in web storage. The
// cache is process-local and namespaced by the authenticated Firebase UID so
// an account switch in the same browser cannot reuse another account's result.
const apiMemoryCache = new Map<string, ApiMemoryCacheEntry>();

async function hashRequestBody(body: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(body);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic fallback for constrained test/runtime environments.
  let hash = 2166136261;
  for (let i = 0; i < body.length; i += 1) {
    hash ^= body.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function cacheKeyFor(uid: string, resource: RequestInfo, body: string): Promise<string> {
  return `${uid}:${resource.toString()}:${await hashRequestBody(body)}`;
}

function memoryCacheGet(key: string): unknown | undefined {
  const entry = apiMemoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp >= CACHE_EXPIRY_MS) {
    apiMemoryCache.delete(key);
    return undefined;
  }
  return entry.data;
}

export function clearApiMemoryCache(): void {
  apiMemoryCache.clear();
}

function memoryCacheSet(key: string, data: unknown): void {
  apiMemoryCache.delete(key);
  apiMemoryCache.set(key, { timestamp: Date.now(), data });
  while (apiMemoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldest = apiMemoryCache.keys().next().value;
    if (typeof oldest !== 'string') break;
    apiMemoryCache.delete(oldest);
  }
}

export async function fetchWithCache(resource: RequestInfo, options: RequestInit & { timeout?: number } = {}) {
  // Personalized POST responses are cached only in memory and only for the
  // currently authenticated Firebase user. This avoids cross-account reuse
  // and prevents profile/journal/AI data from surviving a browser restart.
  if (options.method === 'POST' && options.body && typeof options.body === 'string') {
    const uid = auth.currentUser?.uid;
    if (!uid) return fetchWithTimeout(resource, options);

    const cacheKey = await cacheKeyFor(uid, resource, options.body);
    const cached = memoryCacheGet(cacheKey);
    if (cached !== undefined) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetchWithTimeout(resource, options);
    if (response.ok) {
      response.clone().json().then((data: unknown) => {
        // The response may finish after logout/account switch. The key remains
        // bound to the originating UID, so another account cannot consume it.
        memoryCacheSet(cacheKey, data);
      }).catch(() => {});
    }
    return response;
  }
  return fetchWithTimeout(resource, options);
}

export async function fetchWithTimeout(resource: RequestInfo, options: RequestInit & { timeout?: number, retries?: number } = {}): Promise<Response> {
  const { timeout = 60000, retries = 2 } = options;
  let attempt = 0;

  while (attempt <= retries) {
    const token = await getAuthToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    options.headers = headers;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      if (attempt > 0) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('klar_api_retry_start'));
        }
      }

      const response = await fetch(resource, {
        ...options,
        signal: controller.signal
      });

      if (attempt > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('klar_api_retry_end'));
      }

      if (!response.ok && attempt < retries) {
         // BEFUND 13.08.2026: Hier stand `response.status >= 500` als einzige
         // Bedingung. Damit wurde ein 503 aus `kiPolitik.ts` — also ein
         // erschoepftes KI-Kontingent, das der Server bereits selbst
         // wiederholt hatte — noch zweimal nachgefragt. Aus einem Ausfall
         // wurden drei Anfragen. Siehe `src/lib/wiederholung.ts`.
         //
         // Der Koerper wird auf einer KOPIE gelesen: `response` geht gleich
         // an den Aufrufer, und ein einmal gelesener Koerper laesst sich
         // nicht erneut lesen.
         let koerper: unknown = null;
         try {
           koerper = await response.clone().json();
         } catch {
           // Kein JSON: dann auch kein `code`, also gilt die 5xx-Regel.
           koerper = null;
         }
         if (sollWiederholen(response.status, koerper)) {
           throw new Error(`Server error: ${response.status}`);
         }
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(id);

      if (attempt >= retries) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('klar_api_retry_end'));
          window.dispatchEvent(new CustomEvent('klar_api_error', {
            // URL paths and query strings may contain bearer download tokens,
            // UIDs or other private values. UI error events need no raw payload.
            detail: { message: 'Netzwerkfehler', url: '[redacted]' }
          }));
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Zeitüberschreitung bei der Server-Anfrage. Bitte versuche es später nochmal.');
        }
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
      attempt++;
    } finally {
      clearTimeout(id);
    }
  }

  throw new Error("Unreachable");
}

export async function askAICoach(prompt: string, context?: string): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/ai-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token || ''}` } : {}) },
    body: JSON.stringify({ prompt, context }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return data.text;
}

export async function askAICoachStructured(prompt: string, context?: string): Promise<{ text: string, preferences?: string }> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/ai-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token || ''}` } : {}) },
    body: JSON.stringify({ prompt, context }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return { text: data.text, preferences: data.preferences };
}

export async function fetchDateIdeas(interests: string): Promise<{title: string, description: string}[]> {
  const response = await fetchWithCache('/api/date-ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interests }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return data.ideas || [];
}

export async function fetchProfileSummary(userInterests: string[], profileName: string, profileInterests: string[], profileBio: string): Promise<string> {
  const response = await fetchWithCache('/api/profile-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userInterests,
      profileName,
      profileInterests,
      profileBio
    }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return data.summary || "";
}

export async function parseProfileImport(textData: string): Promise<{ bio: string, interests: string[] }> {
  const response = await fetchWithCache('/api/parse-profile-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textData }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.text().then(text => text ? JSON.parse(text) : {});
}

export async function optimizeProfileApi(bio: string, interests: string[]): Promise<{ optimizedBio: string, suggestedInterests: string[] }> {
  const response = await fetchWithCache('/api/optimize-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bio, interests }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.text().then(text => text ? JSON.parse(text) : {});
}

export async function fetchDateChecklist(interests: string[]): Promise<{category: "Praktisches" | "Outfit & Styling" | "Mindset" | "Gesprächsthemen", text: string}[]> {
  const response = await fetchWithCache('/api/date-checklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interests }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return data.items || [];
}

export async function fetchDateArchiveAnalysis(reflections: unknown[]): Promise<{patterns: string[], learning: string}> {
  const response = await fetchWithCache('/api/date-archive-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reflections }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return { patterns: data.patterns || [], learning: data.learning || "" };
}

export async function fetchDatingSuccessScore(reflections: unknown[]): Promise<{scores: {category: string, score: number}[], insight: string, trend?: {name: string, score: number}[]}> {
  const response = await fetchWithCache('/api/dating-success-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reflections }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return { scores: data.scores || [], insight: data.insight || "", trend: data.trend || [] };
}

export async function fetchCompatibilityRadar(userInterests: string[], verbindungen: unknown[]): Promise<{subject: string, A: number}[]> {
  const response = await fetchWithCache('/api/compatibility-radar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInterests, verbindungen }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return data.data || [];
}

export async function fetchMatchContextAnalysis(reflections: unknown[]): Promise<{topics: {name: string, reason: string, score: number}[]}> {
  const response = await fetchWithCache('/api/verbindung-context-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reflections }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.text().then(text => text ? JSON.parse(text) : {});
}

export async function fetchSmartVibeMap(reflections: unknown[]): Promise<{locations: {name: string, vibe: string, reason: string}[]}> {
  const response = await fetchWithCache('/api/smart-vibe-map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reflections }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.text().then(text => text ? JSON.parse(text) : {});
}

export async function fetchIcebreaker(userInterests: string[], verbindungContext: unknown): Promise<{icebreaker: string, reasoning: string}> {
  const response = await fetchWithCache('/api/icebreaker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInterests, verbindungContext }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.text().then(text => text ? JSON.parse(text) : {});
}

export async function fetchSmartDatePlanner(weather: string, availability: string, verbindungContext: unknown, location?: string | null): Promise<{suggestions: {title: string, description: string, type: string}[]}> {
  const response = await fetchWithCache('/api/smart-date-planner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weather, availability, verbindungContext, location }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.text().then(text => text ? JSON.parse(text) : {});
}

export async function fetchCityTrendRadar(location?: string | null): Promise<{trends: {name: string, description: string, vibe: string}[]}> {
  const response = await fetchWithCache('/api/city-trend-radar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.text().then(text => text ? JSON.parse(text) : {});
}

export async function fetchDateSummary(reflection: unknown): Promise<{moments: string[], learnings: string[]}> {
  const response = await fetchWithCache('/api/date-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reflection }),
  });
  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }
  return response.text().then(text => text ? JSON.parse(text) : {});
}

export async function fetchReflectionQuestions(rating: number, verbindungName: string): Promise<string[]> {
  const response = await fetchWithCache('/api/reflection-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, verbindungName }),
  });
  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }
  const data = await response.text().then(text => text ? JSON.parse(text) : {});
  return data.questions || [];
}

export async function verifyPhoto(photoUrl: string) {
  const token = await getAuthToken();
  const res = await fetch("/api/verify-photo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`
    },
    body: JSON.stringify({ photoUrl })
  });
  if (!res.ok) throw new Error("Failed to verify photo");
  return await res.json();
}

export async function subscribeKlarPlus() {
  const token = await getAuthToken();
  const res = await fetch("/api/subscribe-klar-plus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`
    }
  });
  if (!res.ok) throw new Error("Failed to subscribe");
  return await res.json();
}

// Compatibility wrapper: preserve fetch behavior, but NEVER emit raw URLs,
// query strings, request objects or caught exception messages into telemetry.
// Profile photo ?token= URLs are long-lived bearer credentials (P1 #206).
export async function monitoredFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const startTime = performance.now();
  try {
    const response = await fetch(input, init);
    const duration = performance.now() - startTime;
    if (duration > 500) {
      // Duration is non-sensitive. Omit path/host/query and headers entirely.
      console.debug(`[Latency Alert] HTTP request took ${Math.round(duration)}ms`);
    }
    return response;
  } catch (error) {
    // reportClientError() may send data to Sentry when consent is enabled.
    // Report only a fixed code, never error.message, stack, URL or cause.
    melde('http_request_failed', new Error('Network request failed'));
    throw error;
  }
}

export async function askAIList(prompt: string): Promise<string[]> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/ai-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token || ''}` } : {}) },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function analyzeReflection(text: string): Promise<{mood?: "good"|"neutral"|"bad", tags?: string[], personName?: string}> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/analyze-reflection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token || ''}` } : {}) },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorData = await response.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
    throw new Error(errorData.error || 'Fehler bei der KI-Verarbeitung.');
  }

  return await response.json();
}

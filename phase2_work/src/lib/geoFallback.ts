export interface Coordinates {
  latitude: number;
  longitude: number;
  isFallback?: boolean;
}

const MUNICH_FALLBACK: Coordinates = {
  latitude: 48.1351,
  longitude: 11.5820,
  isFallback: true,
};

export async function getCurrentPositionSafe(timeoutMs = 5000): Promise<Coordinates> {
  if (!navigator.geolocation) {
    console.warn("Geolocation wird von diesem Browser nicht unterstützt. Verwende München-Fallback.");
    return MUNICH_FALLBACK;
  }

  return new Promise((resolve) => {
    let isResolved = false;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.warn("Geolocation Timeout überschritten. Verwende München-Fallback.");
        resolve(MUNICH_FALLBACK);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            isFallback: false,
          });
        }
      },
      (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          if (error.code !== 1) {
            console.warn(`Geolocation-Fehler (${error.code}): ${error.message}. Verwende München-Fallback.`);
          } else {
            console.debug(`Geolocation nicht freigegeben. Verwende München-Fallback.`);
          }
          resolve(MUNICH_FALLBACK);
        }
      },
      { timeout: timeoutMs, maximumAge: 60000, enableHighAccuracy: false }
    );
  });
}

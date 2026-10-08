/**
 * Service zur Kosten- und Ressourcenoptimierung (Caching, Read-Reduktion, Listener-Lifecycle)
 */
export class CostOptimizationService {
  private static queryCache = new Map<string, { data: unknown; timestamp: number }>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minuten TTL

  /**
   * Caches Firestore read results in memory to eliminate duplicate reads within TTL.
   */
  public static getCachedData<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
      this.queryCache.delete(key);
      return null;
    }
    return cached.data as T;
  }

  public static setCachedData(key: string, data: unknown): void {
    this.queryCache.set(key, { data, timestamp: Date.now() });
  }

  public static clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Komprimiert Bilder clientseitig vor dem Upload, um Storage- und Bandbreitenkosten zu senken.
   */
  public static async compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Image compression failed.'));
            },
            'image/webp',
            quality
          );
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  }
}

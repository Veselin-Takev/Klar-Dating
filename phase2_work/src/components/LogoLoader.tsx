import { useState } from "react";

export function LogoLoader({ sizeClass = "w-20 h-20", text = "Wird geladen..." }: { sizeClass?: string; text?: string }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className="flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      {!hasError ? (
        <img
          src="/Klar_Logo.png"
          alt="Klar Logo"
          className={`${sizeClass} animate-pulse opacity-90 object-contain`}
          aria-hidden="true"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className={`${sizeClass} flex items-center justify-center rounded-[var(--radius-card)] bg-surface`}>
          <span className="text-muted-foreground text-xs font-medium">Klar</span>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { AlertCircle, } from 'lucide-react';
import { reportClientError } from '../lib/diagnostics';

export function GlobalApiOverlay() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handleError = () => {
      setErrorDetails('Die Anfrage konnte nicht abgeschlossen werden. Bitte erneut versuchen.');
      reportClientError(new Error('API request failed'));
    };

    const handleRetryStart = () => {
      setIsRetrying(true);
    };

    const handleRetryEnd = () => {
      setIsRetrying(false);
      setErrorDetails(null);
    };

    window.addEventListener('klar_api_error', handleError);
    window.addEventListener('klar_api_retry_start', handleRetryStart);
    window.addEventListener('klar_api_retry_end', handleRetryEnd);

    return () => {
      window.removeEventListener('klar_api_error', handleError);
      window.removeEventListener('klar_api_retry_start', handleRetryStart);
      window.removeEventListener('klar_api_retry_end', handleRetryEnd);
    };
  }, []);

  return (
    <AnimatePresence>
      {(isRetrying || errorDetails) && (
        <motion.div
          role={errorDetails && !isRetrying ? 'alert' : 'status'}
          aria-atomic="true"
          initial={reducedMotion ? false : { opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-stone-900/90 dark:bg-stone-100/90 text-white dark:text-stone-900 px-4 py-3 rounded-2xl shadow-sm flex items-center gap-3"
        >
          {isRetrying ? (
            <div aria-hidden="true" className="w-6 h-6 bg-stone-200 dark:bg-stone-700 motion-safe:animate-pulse rounded"></div>
          ) : (
            <AlertCircle aria-hidden="true" size={18} className="text-rose-400" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {isRetrying ? 'Wird neu versucht...' : 'Fehler aufgetreten'}
            </span>
            {!isRetrying && errorDetails && (
              <span className="text-[10px] opacity-80">{errorDetails}</span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

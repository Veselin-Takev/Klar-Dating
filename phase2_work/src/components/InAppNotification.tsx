import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, ChevronDown, X } from "lucide-react";
import { motion } from "motion/react";

export interface InAppNotificationMessage {
  title: string;
  body?: string;
  message?: string;
  persistent?: boolean;
}

interface Props {
  notification: InAppNotificationMessage;
  onDismiss: () => void;
  timeoutMs?: number;
}

const AUTO_DISMISS_MS = 6000;

export function InAppNotification({
  notification,
  onDismiss,
  timeoutMs = AUTO_DISMISS_MS,
}: Props) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<number | null>(null);
  // Parent renders create new callback identities; they must not restart the countdown.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const startedAtRef = useRef<number | null>(null);
  const remainingRef = useRef(timeoutMs);
  const pauseReasonsRef = useRef(new Set<string>());
  const hasDetails = Boolean(notification.body || notification.message);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startedAtRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    if (
      notification.persistent ||
      pauseReasonsRef.current.size > 0 ||
      timerRef.current !== null ||
      remainingRef.current <= 0
    ) {
      return;
    }

    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      startedAtRef.current = null;
      remainingRef.current = 0;
      onDismissRef.current();
    }, remainingRef.current);
  }, [notification.persistent]);

  const pause = useCallback(
    (reason: string) => {
      pauseReasonsRef.current.add(reason);
      if (timerRef.current !== null && startedAtRef.current !== null) {
        remainingRef.current = Math.max(
          0,
          remainingRef.current - (Date.now() - startedAtRef.current),
        );
      }
      clearTimer();
    },
    [clearTimer],
  );

  const resume = useCallback(
    (reason: string) => {
      pauseReasonsRef.current.delete(reason);
      startTimer();
    },
    [startTimer],
  );

  useEffect(() => {
    setExpanded(false);
    remainingRef.current = timeoutMs;
    pauseReasonsRef.current.clear();
    clearTimer();
    startTimer();
    return clearTimer;
  }, [clearTimer, notification, startTimer, timeoutMs]);

  const toggleDetails = () => {
    setExpanded((current) => {
      const next = !current;
      if (next) pause("expanded");
      else resume("expanded");
      return next;
    });
  };

  const dismiss = () => {
    clearTimer();
    onDismiss();
  };

  return (
    <motion.section
      initial={{ y: -100, opacity: 0, x: "-50%" }}
      animate={{ y: 16, opacity: 1, x: "-50%" }}
      exit={{ y: -100, opacity: 0, x: "-50%" }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => pause("hover")}
      onMouseLeave={() => resume("hover")}
      onFocusCapture={() => pause("focus")}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          resume("focus");
        }
      }}
      className="absolute top-0 left-1/2 z-50 w-[90%] bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-lg border border-stone-100 dark:border-stone-700 flex items-start gap-3 transition-all"
    >
      <div
        aria-hidden="true"
        className="bg-brand/10 dark:bg-brand-light/10 p-2 rounded-full shrink-0 mt-0.5"
      >
        <Bell size={20} className="text-brand dark:text-brand-light" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <h2 className="font-medium text-stone-900 dark:text-stone-100 text-sm truncate">
            {notification.title}
          </h2>
          {hasDetails && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={toggleDetails}
              className="min-h-11 px-2 text-xs text-brand dark:text-brand-light font-medium flex items-center gap-0.5 shrink-0 hover:underline"
            >
              {expanded ? "Weniger" : "Details"}
              <ChevronDown
                aria-hidden="true"
                size={13}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
        {hasDetails && (
          <p
            id={detailsId}
            className={`text-xs text-stone-500 dark:text-stone-400 leading-relaxed transition-all ${
              expanded ? "max-h-96 opacity-100 break-words" : "line-clamp-2"
            }`}
          >
            {notification.body || notification.message}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Benachrichtigung schließen"
        onClick={dismiss}
        className="min-h-11 min-w-11 inline-flex items-center justify-center text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 shrink-0"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </motion.section>
  );
}

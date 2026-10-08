import { motion, useReducedMotion } from 'motion/react';
import { useLocation, useInRouterContext } from 'react-router';

export type SkeletonVariant = 'chat' | 'chats' | 'dashboard';

/**
 * Erkennt, ob ein gegebener Pfad zu einer Chat-Konversation gehört
 * (z. B. /chat, /chat/:id, /chats/:id, /messages/:id).
 */
export const isChatPath = (pathname: string): boolean => {
  if (!pathname) return false;
  const withoutQuery = pathname.split('?')[0] ?? '';
  const withoutHash = withoutQuery.split('#')[0] ?? '';
  const cleanPath = withoutHash.trim().toLowerCase();

  // Reine Übersichtsliste '/chats' ohne ID ist kein Einzelchat
  if (cleanPath === '/chats' || cleanPath === '/chats/') {
    return false;
  }

  // /chat, /chat/:id, /chats/:id, /messages/:id, /nachrichten/:id
  if (cleanPath === '/chat' || cleanPath.startsWith('/chat/')) {
    return true;
  }
  if (cleanPath.startsWith('/chats/')) {
    const sub = cleanPath.slice('/chats/'.length).trim();
    if (sub.length > 0) return true;
  }
  if (cleanPath.startsWith('/messages/') || cleanPath.startsWith('/nachrichten/')) {
    return true;
  }

  return false;
};

/**
 * Erkennt, ob ein Pfad die Konversations-Übersichtsliste darstellt.
 */
export const isChatsListPath = (pathname: string): boolean => {
  if (!pathname) return false;
  const withoutQuery = pathname.split('?')[0] ?? '';
  const withoutHash = withoutQuery.split('#')[0] ?? '';
  const cleanPath = withoutHash.trim().toLowerCase();
  return cleanPath === '/chats' || cleanPath === '/chats/';
};

export const getSkeletonVariant = (pathname: string): SkeletonVariant => {
  if (isChatPath(pathname)) {
    return 'chat';
  }
  if (isChatsListPath(pathname)) {
    return 'chats';
  }
  return 'dashboard';
};

export const BaseSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-stone-200/60 dark:bg-stone-800/60 ${className}`} />
);

export interface ChatBubbleSkeletonProps {
  isMe?: boolean;
  lines?: number;
  width?: string;
  hasAvatar?: boolean;
  timestamp?: boolean;
  statusIcon?: boolean;
  className?: string;
}

/**
 * Spezifischer Chat-Bubble-Platzhalter anstelle generischer Boxen.
 * Bildet eingehende (links mit Avatar & Zeilen) und ausgehende (rechts) Nachrichten präzise nach.
 */
export const ChatBubbleSkeleton = ({
  isMe = false,
  lines = 2,
  width,
  hasAvatar = true,
  timestamp = true,
  statusIcon = false,
  className = "",
}: ChatBubbleSkeletonProps) => {
  const defaultWidth = isMe
    ? (lines === 1 ? 'w-44 sm:w-56' : 'w-52 sm:w-64')
    : (lines === 1 ? 'w-48 sm:w-60' : lines === 3 ? 'w-64 sm:w-72' : 'w-56 sm:w-68');
  const bubbleWidth = width || defaultWidth;

  return (
    <div
      className={`flex items-end gap-2 max-w-[85%] w-full ${
        isMe ? 'justify-end self-end ml-auto' : 'justify-start self-start mr-auto'
      } ${className}`}
      data-testid={isMe ? 'chat-bubble-outgoing-skeleton' : 'chat-bubble-incoming-skeleton'}
    >
      {!isMe && hasAvatar && (
        <BaseSkeleton className="h-7 w-7 rounded-full shrink-0 mb-1" />
      )}

      <div
        className={`p-3.5 space-y-2 rounded-2xl ${bubbleWidth} ${
          isMe
            ? 'bg-stone-300/60 dark:bg-stone-700/60 rounded-tr-xs rounded-br-2xl shadow-2xs'
            : 'bg-stone-200/70 dark:bg-stone-800/70 border border-stone-200/50 dark:border-stone-700/50 rounded-tl-xs rounded-bl-2xl shadow-2xs'
        }`}
      >
        {Array.from({ length: lines }).map((_, idx) => (
          <BaseSkeleton
            key={idx}
            className={`h-3.5 rounded ${
              idx === 0
                ? (lines === 1 ? 'w-full' : 'w-11/12')
                : idx === lines - 1
                ? 'w-2/3'
                : 'w-4/5'
            }`}
          />
        ))}

        {timestamp && (
          <div className={`flex items-center gap-1.5 pt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
            <BaseSkeleton className="h-2.5 w-10 rounded opacity-60" />
            {(isMe || statusIcon) && (
              <BaseSkeleton className="h-2.5 w-3.5 rounded-full opacity-60" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** Platzhalter für die "Schreibt gerade..." Chat-Blase */
export const ChatTypingSkeleton = () => (
  <div className="flex items-end gap-2 self-start max-w-[70%]" data-testid="chat-typing-skeleton">
    <BaseSkeleton className="h-6 w-6 rounded-full shrink-0 mb-0.5" />
    <div className="bg-stone-200/70 dark:bg-stone-800/70 rounded-2xl rounded-tl-xs px-3.5 py-2.5 flex items-center gap-1.5 border border-stone-200/50 dark:border-stone-700/50">
      <span className="h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-500 animate-pulse" />
      <span className="h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-500 animate-pulse [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-500 animate-pulse [animation-delay:300ms]" />
    </div>
  </div>
);

/** Spezifisches Skelett für die Chat-Ansicht mit Kopfzeile, spezifischen Chat-Blasen und Eingabeleiste */
export const ChatSkeleton = () => (
  <div className="flex-1 flex flex-col w-full h-full justify-between overflow-hidden" data-testid="chat-skeleton">
    {/* Chat-Kopfzeile: Zurück, Avatar, Name & Status, Aktionen */}
    <div className="flex items-center justify-between py-2 px-1 border-b border-stone-200/50 dark:border-stone-800/50 mb-2">
      <div className="flex items-center gap-3">
        <BaseSkeleton className="h-8 w-8 rounded-full" />
        <BaseSkeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <BaseSkeleton className="h-4 w-28 rounded" />
          <BaseSkeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <BaseSkeleton className="h-8 w-8 rounded-full" />
        <BaseSkeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>

    {/* Chat-Nachrichtenbereich mit spezifischen Chat-Blasen (eingehend / ausgehend) */}
    <div className="flex-1 flex flex-col justify-end gap-3.5 py-2 px-1 overflow-hidden" data-testid="chat-bubbles-container">
      {/* Datumsanzeige / Trenner */}
      <div className="flex justify-center my-1">
        <BaseSkeleton className="h-5 w-24 rounded-full" />
      </div>

      {/* Eingehende Nachricht 1 */}
      <ChatBubbleSkeleton isMe={false} lines={2} width="w-56 sm:w-64" />

      {/* Ausgehende Nachricht 1 */}
      <ChatBubbleSkeleton isMe={true} lines={2} width="w-48 sm:w-60" statusIcon={true} />

      {/* Eingehende Nachricht 2 */}
      <ChatBubbleSkeleton isMe={false} lines={3} width="w-64 sm:w-72" />

      {/* Ausgehende Nachricht 2 */}
      <ChatBubbleSkeleton isMe={true} lines={1} width="w-40 sm:w-52" statusIcon={true} />

      {/* "Tippt gerade..." Indikator */}
      <ChatTypingSkeleton />
    </div>

    {/* Chat-Eingabeleiste unten (keine Standard-Bottom-Nav im Chat) */}
    <div className="pt-2 pb-1 border-t border-stone-200/50 dark:border-stone-800/50 flex items-center gap-2 mt-auto">
      <BaseSkeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 h-11 rounded-full border border-stone-200/60 dark:border-stone-700/60 px-4 flex items-center">
        <BaseSkeleton className="h-3.5 w-28 rounded-md" />
      </div>
      <BaseSkeleton className="h-10 w-10 rounded-full shrink-0" />
    </div>
  </div>
);

/** Spezifisches Skelett für die Chats-Übersichtsliste */
export const ChatsListSkeleton = () => (
  <div className="flex-1 flex flex-col w-full h-full gap-4 overflow-hidden" data-testid="chats-list-skeleton">
    {/* Kopfzeile */}
    <div className="flex justify-between items-center px-1 pt-2">
      <BaseSkeleton className="h-7 w-24 rounded-lg" />
      <BaseSkeleton className="h-9 w-9 rounded-full" />
    </div>

    {/* Suchfeld */}
    <BaseSkeleton className="h-11 w-full rounded-2xl" />

    {/* Chat-Zeilen */}
    <div className="flex-1 flex flex-col gap-3 py-1 overflow-hidden">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-2xl border border-stone-200/40 dark:border-stone-800/40">
          <BaseSkeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center">
              <BaseSkeleton className="h-4 w-32 rounded" />
              <BaseSkeleton className="h-3 w-10 rounded" />
            </div>
            <BaseSkeleton className="h-3 w-48 rounded" />
          </div>
        </div>
      ))}
    </div>

    {/* Untere Navigationsleiste */}
    <div className="h-16 w-full rounded-full border border-stone-100 dark:border-stone-800 flex items-center justify-around px-4 mt-auto shrink-0">
      {[1, 2, 3, 4, 5].map(i => (
        <BaseSkeleton key={i} className="h-10 w-10 rounded-full" />
      ))}
    </div>
  </div>
);

/** Spezifisches Skelett für das Dashboard mit Banner, Profilkarte, Aktionsknöpfen und Navigation */
export const DashboardSkeleton = () => (
  <div className="flex-1 flex flex-col gap-4 w-full h-full overflow-hidden" data-testid="dashboard-skeleton">
    {/* Kopfzeile */}
    <div className="flex justify-between items-center mt-2 px-1">
      <BaseSkeleton className="h-8 w-36 rounded-lg" />
      <div className="flex gap-2">
        <BaseSkeleton className="h-9 w-9 rounded-full" />
        <BaseSkeleton className="h-9 w-9 rounded-full" />
      </div>
    </div>

    {/* Oberes Impuls- / Status-Banner */}
    <BaseSkeleton className="h-20 w-full rounded-3xl shrink-0" />

    {/* Hauptbereich: Profilkarte mit Bildplatzhalter, Bio und Interaktionsknöpfen */}
    <div className="flex-1 min-h-0 w-full rounded-3xl border border-stone-200/50 dark:border-stone-800/50 p-4 flex flex-col justify-between overflow-hidden">
      {/* Bildbereich */}
      <BaseSkeleton className="h-44 sm:h-52 w-full rounded-2xl shrink-0 mb-3" />

      {/* Profilangaben */}
      <div className="space-y-2.5">
        <BaseSkeleton className="h-6 w-44 rounded-lg" />
        <div className="flex gap-2">
          <BaseSkeleton className="h-4 w-24 rounded-full" />
          <BaseSkeleton className="h-4 w-16 rounded-full" />
        </div>
        <BaseSkeleton className="h-3.5 w-full rounded" />
        <BaseSkeleton className="h-3.5 w-4/5 rounded" />

        {/* Interessen-Tags */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <BaseSkeleton className="h-6 w-20 rounded-full" />
          <BaseSkeleton className="h-6 w-16 rounded-full" />
          <BaseSkeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* Aktionsknöpfe: Weiter / Verbinden */}
      <div className="flex justify-center items-center gap-6 pt-3 mt-auto">
        <BaseSkeleton className="h-14 w-14 rounded-full" />
        <BaseSkeleton className="h-14 w-14 rounded-full" />
      </div>
    </div>

    {/* Untere Navigationsleiste */}
    <div className="h-16 w-full rounded-full border border-stone-100 dark:border-stone-800 flex items-center justify-around px-4 shrink-0">
      {[1, 2, 3, 4, 5].map(i => (
        <BaseSkeleton key={i} className="h-10 w-10 rounded-full" />
      ))}
    </div>
  </div>
);

export interface AppSkeletonProps {
  pathname?: string;
  variant?: SkeletonVariant;
  className?: string;
  style?: React.CSSProperties;
}

const SkeletonContent = ({
  pathname,
  variant: propVariant,
  className = "",
  style,
}: {
  pathname: string;
  variant?: SkeletonVariant;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const variant = propVariant ?? getSkeletonVariant(pathname);
  const shouldReduceMotion = Boolean(useReducedMotion());

  let content: React.ReactNode;
  let ariaLabel = "Wird geladen";

  if (variant === 'chat') {
    content = <ChatSkeleton />;
    ariaLabel = "Chat wird geladen";
  } else if (variant === 'chats') {
    content = <ChatsListSkeleton />;
    ariaLabel = "Chats werden geladen";
  } else {
    content = <DashboardSkeleton />;
    ariaLabel = "Dashboard wird geladen";
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
      className={`animate-skeleton-pulse h-[100dvh] flex flex-col p-4 sm:p-6 bg-light-bg dark:bg-dark-bg w-full gap-4 max-w-2xl mx-auto overflow-hidden [will-change:opacity,transform] ${className}`}
      style={{ willChange: 'opacity, transform', ...style }}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-variant={variant}
      data-reduced-motion={shouldReduceMotion ? 'true' : 'false'}
    >
      {content}
    </motion.div>
  );
};

const RoutedSkeleton = ({ pathname: propPath, variant, className, style }: AppSkeletonProps) => {
  const location = useLocation();
  const activePath = propPath ?? location.pathname;
  return <SkeletonContent pathname={activePath} variant={variant} className={className} style={style} />;
};

const UnroutedSkeleton = ({ pathname: propPath, variant, className, style }: AppSkeletonProps) => {
  const activePath = propPath ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  return <SkeletonContent pathname={activePath} variant={variant} className={className} style={style} />;
};

export const AppSkeleton = ({ pathname, variant, className = '', style }: AppSkeletonProps) => {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RoutedSkeleton pathname={pathname} variant={variant} className={className} style={style} />;
  }
  return <UnroutedSkeleton pathname={pathname} variant={variant} className={className} style={style} />;
};

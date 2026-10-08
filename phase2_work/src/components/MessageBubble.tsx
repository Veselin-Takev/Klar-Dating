import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../i18n/format';
import { normalizeLanguage } from '../i18n/locale';
import { CheckCheck, Flag } from 'lucide-react';
import type { ChatMessage } from '../screens/ChatView';

export interface MessageBubbleProps {
  msg: ChatMessage;
  onReportMessage?: (msg: ChatMessage) => void;
}

export function MessageBubble({ msg, onReportMessage }: MessageBubbleProps) {
  const { t, i18n } = useTranslation();
  const isMe = msg.role === 'user';

  const [showOriginal, setShowOriginal] = useState(false);

  // Ist eine Übersetzung vorhanden (und fehlerfrei)?
  const hasTranslation = !!msg.originalText && !msg.translationError;
  const displayText = showOriginal && msg.originalText ? msg.originalText : msg.text;

  const date = new Date(msg.createdAt ?? NaN);
  const timeString = Number.isFinite(date.getTime())
    ? formatDate(date.getTime(), normalizeLanguage(i18n.resolvedLanguage), Intl.DateTimeFormat().resolvedOptions().timeZone)
    : '';

  return (
    <div
      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-5 w-full`}
    >
      <div
        className={`klar-chat-message px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl relative outline-none ${
          isMe
            ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-tr-sm shadow-sm'
            : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-tl-sm text-stone-900 dark:text-stone-100 shadow-sm'
        }`}

      >
        {msg.audioUrl ? (
          <div className="mb-2">
            <audio controls src={msg.audioUrl} className="w-full max-w-[200px] h-8 rounded-full bg-stone-100 dark:bg-stone-800" />
            <p className="mt-3 text-sm italic text-stone-700 dark:text-stone-300 leading-[1.6] border-l-2 border-brand/50 pl-3">
              {msg.audioTranscription || t('messages.transcribing')}
            </p>
          </div>
        ) : (
          <p className="text-base leading-[1.62] break-words whitespace-pre-wrap">{displayText}</p>
        )}

        <div className="flex justify-end items-center mt-3 gap-1.5">
          <span className={`text-xs leading-none ${isMe ? 'text-white/85 dark:text-stone-800/85' : 'text-stone-600 dark:text-stone-300'}`}>{timeString}</span>
          {isMe && <CheckCheck size={14} className={msg.isRead ? "text-stone-100 dark:text-stone-800" : "opacity-70"} />}
          {!isMe && onReportMessage && (
            <button
              type="button"
              aria-label="Nachricht melden"
              onClick={() => onReportMessage(msg)}
              className="min-w-7 min-h-7 inline-flex items-center justify-center text-stone-500 hover:text-red-600 dark:text-stone-400 dark:hover:text-red-400 opacity-80 hover:opacity-100 transition-opacity rounded-full"
            >
              <Flag size={12} />
            </button>
          )}
        </div>
      </div>

      {hasTranslation && <button type="button" aria-pressed={showOriginal}
        className="text-sm underline underline-offset-2 p-2.5 -ml-1 text-stone-700 dark:text-stone-300 focus-visible:outline focus-visible:outline-2"
        onClick={() => setShowOriginal(previous => !previous)}>
        {showOriginal ? t('messages.showTranslation') : t('messages.showOriginal')}
      </button>}
      {(!isMe && (hasTranslation || msg.translationError)) && (
        <span role="status" className="text-xs text-stone-600 dark:text-stone-300 mt-1 px-1 leading-relaxed">
          {msg.translationError ? t('messages.delayed') : !showOriginal
            ? t('messages.translated', { language: msg.sourceLanguage || t('messages.otherLanguage') }) : ''}
        </span>
      )}
    </div>
  );
}


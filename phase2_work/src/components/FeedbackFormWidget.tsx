import { useState } from 'react';
import { MessageSquareHeart, Send, CheckCircle2 } from 'lucide-react';

export function FeedbackFormWidget() {
  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState('');
  const [zustand, setZustand] = useState<'leer' | 'lade' | 'erfolg' | 'fehler'>('leer');
  const [errorMsg, setErrorMsg] = useState('');

  if (!navigator.onLine) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-6 text-center text-stone-500 text-sm">
        (Feedback erfordert eine Internetverbindung)
      </div>
    );
  }

  const submit = async () => {
    if (rating === 0) return;
    setZustand('lade');
    setErrorMsg('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, text })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Senden fehlgeschlagen');
      }
      setZustand('erfolg');
    } catch(e: unknown) {
      setErrorMsg(e.message || 'Senden fehlgeschlagen');
      setZustand('fehler');
    }
  };

  if (zustand === 'erfolg') {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-6 flex flex-col items-center justify-center text-center gap-2">
        <CheckCircle2 size={24} className="text-emerald-500" />
        <p className="font-medium text-stone-900">Danke für dein Feedback!</p>
        <p className="text-sm text-stone-500">Wir lesen jede Rückmeldung aufmerksam.</p>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <MessageSquareHeart size={20} className="text-brand" />
        </div>
        <div>
          <h3 className="font-medium text-stone-900">App-Zufriedenheit</h3>
          <p className="text-sm text-stone-500">Deine Meinung hilft uns, Klar zu verbessern.</p>
        </div>
      </div>

      {zustand === 'fehler' && (
        <div className="text-xs text-red-500 mb-3 bg-red-50 p-2 rounded">{errorMsg}</div>
      )}

      <div className="flex gap-2 mb-4 justify-between max-w-[200px]">
        {[1,2,3,4,5].map(r => (
          <button
            key={r}
            onClick={() => setRating(r)}
            disabled={zustand === 'lade'}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${rating === r ? 'bg-brand text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-brand'}`}
          >
            {r}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={zustand === 'lade'}
        maxLength={2000}
        placeholder="Was können wir besser machen?"
        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand/50 mb-3 resize-none h-24"
      />

      <button
        onClick={submit}
        disabled={rating === 0 || zustand === 'lade'}
        className="w-full bg-stone-900 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {zustand === 'lade' ? 'Wird gesendet...' : <><Send size={16} /> Absenden</>}
      </button>
    </div>
  );
}

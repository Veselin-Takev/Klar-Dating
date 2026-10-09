import { useEffect, useRef, useState } from 'react';
import { beantworteGate, gateStatus, type GateAntwort, type GateZustand } from './klar';

type State = { key: string; status: GateZustand | 'lade' | 'fehler'; data: GateAntwort | null; error: string | null };

export function useChatGate(chatId: string | undefined, uid: string | undefined) {
  const key = JSON.stringify([chatId, uid]);
  const [state, setState] = useState<State>({ key, status: 'lade', data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setSubmitting(false);
    if (!chatId || !uid) {
      setState({ key, status: 'fehler', data: null, error: 'Das Gespräch konnte nicht bestätigt werden.' });
      return () => { ++generation.current; };
    }
    // Do not clear the previous status to "lade" when refreshing the same
    // chat. That transient state hides the gate-answer UI and can make a
    // successful retry appear stuck. The derived visible state still hides
    // any status belonging to a different chat/user key.
    setState(previous => previous.key === key
      ? { ...previous, error: null }
      : { key, status: 'lade', data: null, error: null });
    gateStatus(chatId, controller.signal).then(data => {
      if (generation.current === current) setState({ key, status: data.zustand, data, error: null });
    }).catch(() => {
      if (generation.current === current) setState(previous => ({
        key,
        status: previous.key === key && previous.data ? previous.status : 'fehler',
        data: previous.key === key ? previous.data : null,
        error: 'Der Gesprächsstatus konnte nicht geladen werden. Bitte erneut prüfen.',
      }));
    });
    return () => { ++generation.current; controller.abort(); };
  }, [chatId, uid, key, attempt]);

  // The previous chat's open state is never reused, even before effect cleanup.
  const visible = state.key === key ? state : { key, status: 'lade' as const, data: null, error: null };
  const answer = async (text: string): Promise<boolean> => {
    if (!chatId || !uid || visible.status !== 'du_bist_dran' || submitting || !text.trim()) return false;
    const current = generation.current;
    setSubmitting(true);
    setState(previous => ({ ...previous, error: null }));
    try {
      const data = await beantworteGate(chatId, text);
      if (current !== generation.current) return false;
      setState({ key, status: data.zustand, data, error: null });
      return true;
    } catch {
      if (current === generation.current) setState(previous => ({ ...previous,
        error: 'Die Antwort konnte nicht gespeichert werden. Bitte erneut versuchen.' }));
      return false;
    } finally {
      if (current === generation.current) setSubmitting(false);
    }
  };

  return { ...visible, submitting, answer, refresh: () => setAttempt(value => value + 1) };
}

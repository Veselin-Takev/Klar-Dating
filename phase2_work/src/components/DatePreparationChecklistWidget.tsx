import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ListTodo, Circle, Sparkles, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchDateChecklist, getAuthToken } from '../lib/api';
import { authFetch } from '../lib/authFetch';
import { useAuth } from '../lib/AuthContext';
import { enqueueDatePrepChecklist, flushDatePrepChecklist, loadQueuedDatePrepChecklist, DATE_PREP_CHECKLIST_DEFAULTS } from '../lib/offlineQueue';

interface CheckItem { id: string; category: 'Praktisches' | 'Outfit & Styling' | 'Mindset' | 'Gesprächsthemen'; text: string; checked: boolean; }
interface Props { userInterests: string[]; }

const CATEGORY_MAP: Record<string, CheckItem['category']> = {
  'Outfit & Grooming': 'Outfit & Styling', Outfit: 'Outfit & Styling',
  Mindset: 'Mindset', Gespräch: 'Gesprächsthemen', Gesprächsthemen: 'Gesprächsthemen', Praktisches: 'Praktisches',
};

const defaults = Object.keys(DATE_PREP_CHECKLIST_DEFAULTS);

export function DatePreparationChecklistWidget({ userInterests }: Props) {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const makeItems = (generated: Array<{ category?: string; text: string }>, state: Record<string, boolean>) => generated.slice(0, 24).map((item, index) => ({
    id: defaults[index] ?? `generated-${index}`,
    category: CATEGORY_MAP[item.category ?? ''] ?? 'Praktisches', text: item.text, checked: state[defaults[index] ?? `generated-${index}`] === true,
  }));

  const load = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const serverResponse = await authFetch('/api/checklists/date_prep');
      const serverData = await serverResponse.json();
      let state = serverResponse.ok && serverData.checklist ? serverData.checklist : { ...DATE_PREP_CHECKLIST_DEFAULTS };
      const queued = await loadQueuedDatePrepChecklist(uid);
      if (queued) state = { ...state, ...queued };
      const generated = await fetchDateChecklist(userInterests.length ? userInterests : ['Allgemein']);
      setItems(makeItems(generated, state));
      const token = await getAuthToken();
      if (token) await flushDatePrepChecklist({ ownerUid: uid, token });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Checkliste konnte nicht geladen werden.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [uid]);
  useEffect(() => {
    if (!uid) return;
    const sync = () => { void getAuthToken().then(token => token ? flushDatePrepChecklist({ ownerUid: uid, token }) : undefined); };
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [uid]);

  const toggle = async (id: string) => {
    if (!uid) return;
    const next = items.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
    setItems(next);
    const state = { ...DATE_PREP_CHECKLIST_DEFAULTS };
    next.forEach(item => { state[item.id] = item.checked; });
    try {
      await enqueueDatePrepChecklist(uid, state);
      const token = await getAuthToken();
      if (token && navigator.onLine) await flushDatePrepChecklist({ ownerUid: uid, token });
    } catch { setMessage('Änderung lokal vorgemerkt; Synchronisierung folgt bei Verbindung.'); }
  };

  const share = async () => {
    const text = items.map(i => `- [${i.checked ? 'x' : ' '}] ${i.category}: ${i.text}`).join('\n');
    try { if (navigator.share) await navigator.share({ title: 'Date-Checkliste', text }); else await navigator.clipboard.writeText(text); }
    catch { setMessage('Teilen wurde abgebrochen.'); }
  };

  const progress = useMemo(() => items.length ? Math.round(items.filter(i => i.checked).length / items.length * 100) : 0, [items]);
  const categories: CheckItem['category'][] = ['Praktisches', 'Outfit & Styling', 'Mindset', 'Gesprächsthemen'];

  return <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
    <div className="flex items-start justify-between mb-4"><div><h3 className="font-semibold flex items-center gap-2"><ListTodo size={18} className="text-emerald-500" />Date-Vorbereitung</h3><p className="text-xs text-stone-500 mt-1">UID-geschützt und zwischen IndexedDB und Firestore synchronisiert.</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => void share()} disabled={!items.length} aria-label="Checkliste teilen"><Share2 size={15} /></button><span className="text-xs font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-600">{progress}%</span></div></div>
    {message && <p role="status" aria-live="polite" className="text-xs text-stone-500 mb-3">{message}</p>}
    {loading ? <div className="py-8 text-center text-sm text-stone-500"><Sparkles className="mx-auto mb-2 text-emerald-500" size={22} />Lade Checkliste …</div> : <div className="space-y-4 overflow-y-auto">{categories.map(category => { const categoryItems = items.filter(i => i.category === category); if (!categoryItems.length) return null; return <motion.section key={category} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}><h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">{category}</h4><div className="space-y-2">{categoryItems.map(item => <button type="button" key={item.id} onClick={() => void toggle(item.id)} className="w-full flex items-start gap-2 text-left"><span>{item.checked ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-stone-300" />}</span><span className={`text-sm ${item.checked ? 'line-through text-stone-400' : 'text-stone-700 dark:text-stone-300'}`}>{item.text}</span></button>)}</div></motion.section>; })}</div>}
  </div>;
}

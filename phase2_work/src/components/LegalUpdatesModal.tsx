import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, ExternalLink, Scale, CheckCircle2, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModalAccessibility } from '../lib/useModalAccessibility';

export interface LegalUpdate {
  id: string;
  version: string;
  publishedAt: string;
  titleKey: string;
  descriptionKey: string;
  sourceKey: string;
  sourceUrl: string;
  actionRequired: boolean;
  categoryKey: string;
}

interface LegalUpdatesModalProps {
  updates: LegalUpdate[];
  onClose: () => void;
  onAcknowledge: (id: string) => Promise<boolean>;
  acknowledgedIds: string[];
}

export function LegalUpdatesModal({ updates, onClose, onAcknowledge, acknowledgedIds }: LegalUpdatesModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(onClose);

  const selectTab = (tab: 'new' | 'history') => {
    setActiveTab(tab);
    requestAnimationFrame(() => document.getElementById(`legal-tab-${tab}`)?.focus());
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home' || event.key === 'ArrowLeft') selectTab('new');
    else selectTab('history');
  };

  const acknowledge = async (id: string) => {
    setError(null);
    setPendingId(id);
    const success = await onAcknowledge(id);
    setPendingId(null);
    if (!success) setError(t('legalUpdates.ackError'));
  };

  const newUpdates = updates.filter(update => !acknowledgedIds.includes(update.id));
  const historyUpdates = updates.filter(update => acknowledgedIds.includes(update.id));
  const displayUpdates = activeTab === 'new' ? newUpdates : historyUpdates;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="legal-updates-modal">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60"
        onClick={onClose} aria-hidden="true"
      />
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg max-h-[88vh] bg-surface text-ink rounded-[24px] shadow-lg overflow-hidden flex flex-col border border-line"
        role="dialog" aria-modal="true" aria-labelledby="legal-updates-title" aria-describedby="legal-updates-description"
        ref={dialogRef} tabIndex={-1} onKeyDown={onKeyDown}
      >
        <div className="p-5 border-b border-line flex justify-between items-center bg-canvas">
          <div className="flex items-center gap-2 text-ink">
            <Scale size={20} aria-hidden="true" className="text-accent" />
            <h2 id="legal-updates-title" className="font-semibold text-lg">{t('legalUpdates.title')}</h2>
          </div>
          <button type="button" aria-label={t('legalUpdates.close')} onClick={onClose} className="klar-icon-button text-muted hover:bg-accent-quiet">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label={t('legalUpdates.tabLabel')} className="flex px-5 pt-2 gap-5 border-b border-line bg-surface">
          {(['new', 'history'] as const).map(tab => (
            <button
              key={tab} id={`legal-tab-${tab}`} role="tab" type="button"
              aria-selected={activeTab === tab} aria-controls={`legal-panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1}
              onKeyDown={onTabKeyDown} onClick={() => selectTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === tab ? 'text-accent' : 'text-muted hover:text-ink'}`}
            >
              {tab === 'new' ? `${t('legalUpdates.newTab')} (${newUpdates.length})` : <><History size={14} aria-hidden="true" /> {t('legalUpdates.historyTab')}</>}
              {activeTab === tab && <motion.div layoutId="legalTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />}
            </button>
          ))}
        </div>

        <div id={`legal-panel-${activeTab}`} role="tabpanel" aria-labelledby={`legal-tab-${activeTab}`} tabIndex={0} className="flex-1 overflow-y-auto p-5 space-y-4">
          <p id="legal-updates-description" className="klar-readable text-sm text-muted mb-3">{t('legalUpdates.status')}</p>
          {error && <div role="alert" className="rounded-xl border border-warn/30 bg-accent-quiet px-3 py-2 text-sm text-warn">{error}</div>}

          <AnimatePresence mode="popLayout">
            {displayUpdates.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12 px-4 klar-readable mx-auto">
                <ShieldCheck aria-hidden="true" size={48} className="mx-auto text-muted/60 mb-4" />
                <h3 className="text-ink font-semibold mb-1">{t(activeTab === 'new' ? 'legalUpdates.emptyNew' : 'legalUpdates.emptyHistory')}</h3>
                <p className="text-muted text-sm">{t(activeTab === 'new' ? 'legalUpdates.emptyNewHint' : 'legalUpdates.emptyHistoryHint')}</p>
              </motion.div>
            ) : displayUpdates.map(update => {
              const isAcknowledged = acknowledgedIds.includes(update.id);
              return (
                <motion.article key={update.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`klar-card rounded-2xl p-5 transition-colors ${update.actionRequired && !isAcknowledged ? 'bg-accent-quiet/70 border-accent/40' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-ink text-base pr-4 leading-tight">{t(update.titleKey)}</h3>
                      <p className="text-xs text-muted mt-1">v{update.version} · {t(update.categoryKey)}</p>
                    </div>
                    {update.actionRequired && !isAcknowledged && <span className="shrink-0 bg-accent-quiet text-accent text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-full">{t('legalUpdates.actionRequired')}</span>}
                    {isAcknowledged && <><CheckCircle2 aria-hidden="true" size={16} className="text-emerald-500 shrink-0" /><span className="sr-only">{t('legalUpdates.acknowledged')}</span></>}
                  </div>
                  <p className="text-sm text-muted mb-3 leading-[1.65]">{t(update.descriptionKey)}</p>
                  <div className="flex items-center justify-between mt-4 gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{t('legalUpdates.published')}: {update.publishedAt}</span><span aria-hidden="true">•</span><span className="flex items-center gap-1"><ExternalLink size={10} aria-hidden="true" /> {t(update.sourceKey)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className="min-h-11 text-sm border border-line-ui px-3 py-2 rounded-xl font-medium hover:bg-accent-quiet">{t('legalUpdates.openSource')}</a>
                      {!isAcknowledged && <button type="button" disabled={pendingId === update.id} onClick={() => void acknowledge(update.id)} className="min-h-11 text-sm bg-accent text-on-accent px-3 py-2 rounded-xl font-medium hover:bg-accent-strong disabled:opacity-50">{pendingId === update.id ? '…' : t('legalUpdates.acknowledge')}</button>}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import { Gift, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function LaunchPromoWidget() {
  const { user, profileData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; months?: number; foundingNumber?: number } | null>(null);

  // Verstecken, wenn kein User, bereits geclaimed oder Promo verpasst
  if (!user?.uid || !profileData || profileData.launchPromoClaimed || profileData.launchPromoMissed || profileData.plan === 'plus') {
    return null;
  }

  const claimPromo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/claim-launch-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();

      if (data.status === 'success') {
        setResult(data);
      } else if (data.status === 'missed') {
        setResult(data);
      } else {
        setResult({ status: 'already_claimed' });
      }
    } catch (e: unknown) {
      setResult({ status: 'error', months: 0 });
    } finally {
      setLoading(false);
    }
  };

  if (result?.status === 'error') {
    return (
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4 flex items-start gap-3">
        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-medium text-ink">Fehler aufgetreten</p>
          <p className="text-sm text-muted">
            Bitte versuche es später noch einmal.
          </p>
        </div>
      </div>
    );
  }

  if (result?.status === 'success') {
    return (
      <div className="bg-accent-quiet border border-accent/20 p-4 rounded-xl mb-4 flex items-start gap-3">
        <CheckCircle2 className="text-accent shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-medium text-ink">Willkommen bei den Founding Members!</p>
          <p className="text-sm text-muted">
            Du bist Founding Member #{result.foundingNumber}. {result.months ? <>Du erhältst {result.months} {result.months === 1 ? 'Monat' : 'Monate'} Klar+ geschenkt.</> : 'Dein Founding-Member-Status ist gesichert.'}
          </p>
        </div>
      </div>
    );
  }

  if (result?.status === 'missed') {
    return (
      <div className="bg-stone-100 border border-stone-200 p-4 rounded-xl mb-4 flex items-start gap-3">
        <AlertCircle className="text-stone-500 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-medium text-ink">Schade!</p>
          <p className="text-sm text-muted">
            Die ersten 500 Founding-Member-Plätze sind bereits vergeben.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-accent-quiet border border-accent/30 p-4 rounded-xl mb-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
        <Sparkles size={48} className="text-accent" />
      </div>

      <div className="flex items-start gap-3 relative z-10">
        <Gift className="text-accent shrink-0 mt-1" size={24} />
        <div>
          <p className="font-medium text-ink text-lg mb-1">Klar Founding 500</p>
          <p className="text-sm text-muted leading-relaxed mb-3">
            Die ersten 500 werden Founding Members. Die ersten 100 erhalten zusätzlich Klar+; die ersten 10 sogar 3 Monate.
          </p>
          <button
            onClick={claimPromo}
            disabled={loading}
            className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Wird geprüft...' : 'Jetzt Geschenk sichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

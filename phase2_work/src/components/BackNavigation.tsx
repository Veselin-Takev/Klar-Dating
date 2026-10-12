import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

interface BackNavigationProps {
  fallback: string;
  dirty?: boolean;
  disabled?: boolean;
  label?: string;
}

/** Safe in-app back navigation with an explicit fallback for direct/deep links. */
export function BackNavigation({ fallback, dirty = false, disabled = false, label = 'Zurück' }: BackNavigationProps) {
  const navigate = useNavigate();

  const goBack = () => {
    if (dirty && !window.confirm('Ungespeicherte Änderungen verwerfen und zurückgehen?')) return;
    // The previous history entry may be external; never navigate outside Klar.
    const index = typeof window !== 'undefined' ? (window.history.state as { idx?: unknown } | null)?.idx : null;
    if (typeof index === 'number' && Number.isInteger(index) && index > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return (
    <button type="button" onClick={goBack} disabled={disabled}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-line-ui bg-[#FAF8F5] px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700">
      <ArrowLeft size={18} aria-hidden="true" />
      {label}
    </button>
  );
}

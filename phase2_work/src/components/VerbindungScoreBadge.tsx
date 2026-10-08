

interface VerbindungScoreBadgeProps {
  score: number;
  className?: string;
}

export function VerbindungScoreBadge({ score, className = '' }: VerbindungScoreBadgeProps) {
  // Calculate SVG stroke dasharray
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Determine color based on score
  let strokeColor = 'text-brand dark:text-brand-light';
  if (score >= 90) strokeColor = 'text-emerald-500';
  else if (score >= 70) strokeColor = 'text-brand dark:text-brand-light';
  else if (score >= 50) strokeColor = 'text-amber-500';
  else strokeColor = 'text-rose-500';

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Background circle */}
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-stone-200 dark:text-stone-700"
        />
        {/* Progress circle */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${strokeColor} transition-all duration-1000 ease-out`}
          strokeLinecap="round"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-[11px] font-bold text-stone-900 dark:text-stone-100 leading-none mt-0.5">
          {score}%
        </span>
      </div>
    </div>
  );
}

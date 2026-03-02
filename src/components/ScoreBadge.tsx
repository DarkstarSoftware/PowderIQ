interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function colorClass(score: number): string {
  if (score >= 80) return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50';
  if (score >= 60) return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
  if (score >= 40) return 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50';
  return 'bg-red-900/60 text-red-300 border-red-700/50';
}

function label(score: number): string {
  if (score >= 80) return 'Epic';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export default function ScoreBadge({ score, size = 'md' }: Props) {
  const sizeClass =
    size === 'lg' ? 'text-3xl px-5 py-2' :
    size === 'sm' ? 'text-xs px-2 py-0.5' :
                    'text-lg px-3 py-1';

  return (
    <span
      className={`inline-flex flex-col items-center rounded-xl border font-bold ${colorClass(score)} ${sizeClass}`}
      role="img"
      aria-label={`Powder score ${score} out of 100 — ${label(score)}`}
    >
      <span>{score}</span>
      {size !== 'sm' && (
        <span className={`font-normal opacity-80 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
          {label(score)}
        </span>
      )}
    </span>
  );
}

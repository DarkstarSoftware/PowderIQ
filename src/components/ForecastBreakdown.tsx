interface Props {
  breakdown: Record<string, number>;
}

const LABELS: Record<string, string> = {
  snowfall24h:   '24h Snowfall',
  snowfall7d:    '7-Day Snowfall',
  baseDepth:     'Base Depth',
  wind:          'Wind',
  tempStability: 'Temp Stability',
  crowd:         'Crowd Factor',
};

function barColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function ForecastBreakdown({ breakdown }: Props) {
  const entries = Object.entries(LABELS).map(([key, label]) => ({
    key,
    label,
    score: breakdown[key] ?? 0,
  }));

  return (
    <div className="space-y-4" role="list" aria-label="Score breakdown by category">
      {entries.map(({ key, label, score }) => (
        <div key={key} role="listitem">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-300">{label}</span>
            <span className="text-sm font-semibold text-white tabular-nums">
              {score}
              <span className="text-gray-500 font-normal">/100</span>
            </span>
          </div>
          <div
            className="h-2 bg-gray-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            aria-label={`${label}: ${score} out of 100`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

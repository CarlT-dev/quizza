interface ProfileStatsProps {
  quizzesCreated: number;
  quizzesTaken: number;
  bestAccuracy?: number;
}

export function ProfileStats({ quizzesCreated, quizzesTaken, bestAccuracy }: ProfileStatsProps) {
  return (
    <div className="px-4 mb-6">
      <div className="bg-transparent overflow-hidden">
        <div className="flex">
          <StatItem
            value={quizzesCreated}
            label="Created"
            isFirst
            hasDivider
          />
          <StatItem
            value={quizzesTaken}
            label="Taken"
            hasDivider
          />
          <StatItem
            value={bestAccuracy !== undefined ? `${bestAccuracy}%` : '—'}
            label="Best Accuracy"
            isLast
          />
        </div>
      </div>
    </div>
  );
}

interface StatItemProps {
  value: string | number;
  label: string;
  isFirst?: boolean;
  isLast?: boolean;
  hasDivider?: boolean;
}

function StatItem({ value, label, isFirst, isLast, hasDivider }: StatItemProps) {
  return (
    <div
      className={`flex-1 flex flex-col items-center py-4 relative ${isFirst ? 'rounded-l-2xl' : ''} ${isLast ? 'rounded-r-2xl' : ''}`}
    >
      <div className="text-2xl font-bold text-primary-500 dark:text-gray-100">
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      {hasDivider && (
        <div
          className="absolute right-0 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-700"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
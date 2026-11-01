import { Card } from '@/shared/components/ui';

/**
 * Skeleton placeholder mirroring the QuizCard layout
 * (colored header section + neutral details section)
 */
export function QuizCardSkeleton() {
  return (
    <Card
      className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      padding='none'
      aria-hidden="true"
    >
      {/* Header section - mirrors QuizCard colored header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <div className="h-7 w-3/4 skeleton skeleton-rounded" />
        <div className="h-5 w-1/3 skeleton skeleton-rounded" />
        <div className="h-4 w-1/4 skeleton skeleton-rounded mt-2" />
        <div className="h-6 w-24 rounded-full skeleton mt-2" />
      </div>

      {/* Content area - mirrors QuizCard details trigger */}
      <div className="p-4">
        <div className="flex items-center gap-1 py-2">
          <div className="w-4 h-4 rounded-full skeleton" />
          <div className="h-3 w-16 skeleton skeleton-rounded" />
        </div>
      </div>
    </Card>
  );
}

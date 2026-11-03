import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useUserStats } from '@/features/quiz/hooks/useUserStats';
import { getUserQuizCount, getQuizzesByIds } from '@/features/quiz';
import { formatRelativeTime, firstAttemptOf } from '@/shared/utils';
import { Button, StatTile } from '@/shared/components/ui';

export function StatusPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stats, attempts, isLoading, error, refetch } = useUserStats(user?.uid);

  // Created-quizzes count drives its own tile
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  // Starts true: until titles resolve (or the row set proves empty), the list
  // is loading — avoids a one-paint "Results unavailable." flash
  const [titlesLoading, setTitlesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (!user) return;
      try {
        const count = await getUserQuizCount(user.uid);
        if (!cancelled) setCreatedCount(count);
      } catch (err) {
        console.error('Failed to load created count:', err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // First-attempt rows, newest first. Quiz docs deleted since the attempt drop
  // out of this list at render time (titles lookup) but stay counted in the
  // stats above — the tiles are the source of truth, the list is a convenience.
  const resultRows = useMemo(
    () =>
      attempts
        .filter(a => firstAttemptOf(a) !== null)
        .sort((a, b) => b.lastAttemptAt.toMillis() - a.lastAttemptAt.toMillis()),
    [attempts]
  );

  // Joined key keeps the titles effect from refetching on every re-render of
  // the same row set
  const rowIdsKey = resultRows.map(r => r.quizId).join(',');

  useEffect(() => {
    let cancelled = false;
    const ids = rowIdsKey ? rowIdsKey.split(',') : [];
    void Promise.resolve().then(async () => {
      if (ids.length === 0) {
        if (!cancelled) {
          setTitles(new Map());
          setTitlesLoading(false);
        }
        return;
      }
      setTitlesLoading(true);
      try {
        // Silently omits docs deleted (or made private) since the attempt
        const docs = await getQuizzesByIds(ids);
        if (!cancelled) setTitles(new Map(docs.map(q => [q.id ?? '', q.title])));
      } catch (err) {
        console.error('Failed to load quiz titles:', err);
        if (!cancelled) setTitles(new Map());
      } finally {
        if (!cancelled) setTitlesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [rowIdsKey]);

  const displayRows = useMemo(
    () =>
      resultRows
        .filter(r => titles.has(r.quizId))
        .map(r => ({
          quizId: r.quizId,
          title: titles.get(r.quizId)!,
          first: firstAttemptOf(r)!,
          lastAttemptAt: r.lastAttemptAt,
        })),
    [resultRows, titles]
  );

  return (
    <div className="min-h-screen bg-primary-50/30 dark:bg-gray-900">
      <header className="px-4 py-3 mb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Status</h1>
      </header>

      <main className="pb-20 px-4">
        {error ? (
          <div className="max-w-[500px] mx-auto flex items-center justify-center py-12">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Stats</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
              <Button onClick={refetch} className="w-full">
                Try Again
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="max-w-[500px] mx-auto space-y-4" aria-hidden="true">
            <div className="h-40 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="max-w-[500px] mx-auto space-y-6">
            {/* IQ headline — never a fake 100 with no first attempts */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 text-center">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Your IQ
              </p>
              {stats ? (
                <>
                  <p className="text-5xl font-bold text-primary-600 dark:text-primary-400 mt-2">
                    {stats.iq}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {stats.avgAccuracy}% avg first-attempt accuracy
                  </p>
                </>
              ) : (
                <>
                  <p className="text-5xl font-bold text-gray-300 dark:text-gray-600 mt-2">—</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Complete a quiz to get your IQ
                  </p>
                </>
              )}
            </div>

            {/* Tiles: first takes only for Taken/Best; Created is all-time */}
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={stats?.quizzesTaken ?? 0} label="Taken" tone="primary" />
              <StatTile value={createdCount ?? 0} label="Created" />
              <StatTile value={stats ? `${stats.bestAccuracy}%` : '—'} label="Best first" tone="green" />
            </div>

            {resultRows.length > 0 && (
              <section aria-label="Results">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Results
                </h2>
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                  {titlesLoading ? (
                    Array.from({ length: Math.min(resultRows.length, 3) }).map((_, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      </div>
                    ))
                  ) : displayRows.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Results unavailable.
                    </p>
                  ) : (
                    displayRows.map((row) => (
                      <button
                        key={row.quizId}
                        type="button"
                        onClick={() => navigate(`/quiz/${row.quizId}/result`)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                            {row.title}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {formatRelativeTime(row.lastAttemptAt)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 flex-shrink-0">
                          <Check className="w-3 h-3" aria-hidden="true" />
                          {row.first.correct}/{row.first.total}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

import { type ReactNode } from 'react';
import { usePullToRefreshContext } from '../context/PullToRefreshContext';
import { PullToRefresh } from './PullToRefresh';

interface GlobalPullToRefreshProps {
  children: ReactNode;
}

export function GlobalPullToRefresh({ children }: GlobalPullToRefreshProps) {
  const { currentHandler } = usePullToRefreshContext();

  return (
    <PullToRefresh
      onRefresh={currentHandler ?? (async () => {})}
      threshold={80}
      resistance={2.5}
    >
      {children}
    </PullToRefresh>
  );
}
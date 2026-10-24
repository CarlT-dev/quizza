import { createContext, useContext, useState, useCallback, type ReactNode, useRef, useEffect } from 'react';

interface PullToRefreshContextValue {
  currentHandler: (() => Promise<void>) | null;
  registerHandler: (handler: () => Promise<void>) => void;
  unregisterHandler: () => void;
}

export const PullToRefreshContext = createContext<PullToRefreshContextValue | null>(null);

export function PullToRefreshProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<(() => Promise<void>) | null>(null);
  const [, forceUpdate] = useState(0);

  const registerHandler = useCallback((handler: () => Promise<void>) => {
    handlerRef.current = handler;
    forceUpdate(n => n + 1);
  }, []);

  const unregisterHandler = useCallback(() => {
    handlerRef.current = null;
    forceUpdate(n => n + 1);
  }, []);

  const value: PullToRefreshContextValue = {
    currentHandler: handlerRef.current,
    registerHandler,
    unregisterHandler,
  };

  return (
    <PullToRefreshContext.Provider value={value}>
      {children}
    </PullToRefreshContext.Provider>
  );
}

export function usePullToRefreshContext() {
  const context = useContext(PullToRefreshContext);
  if (!context) {
    throw new Error('usePullToRefreshContext must be used within PullToRefreshProvider');
  }
  return context;
}

export function usePageRefresh(handler: () => Promise<void>) {
  const { registerHandler, unregisterHandler } = usePullToRefreshContext();
  useEffect(() => {
    registerHandler(handler);
    return () => unregisterHandler();
  }, [handler, registerHandler, unregisterHandler]);
}
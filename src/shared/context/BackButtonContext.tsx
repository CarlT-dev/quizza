import { createContext, useContext, useMemo, useState, useCallback, useRef, useLayoutEffect, type ReactNode } from 'react';
import type { BackButtonHandler, BackButtonRegistry, BackButtonContextValue } from '@/shared/types/backButton';

const BackButtonContext = createContext<BackButtonContextValue | null>(null);

/**
 * Provider component for back button handler registry.
 * Wraps the app and provides a centralized registry for overlay close handlers.
 */
export function BackButtonProvider({ children }: { children: ReactNode }) {
  const [handlers, setHandlers] = useState<Map<string, BackButtonHandler>>(new Map());
  // Ref to always read the latest handlers without triggering re-renders
  const handlersRef = useRef(handlers);

  // Keep ref in sync with state (useLayoutEffect to avoid render-phase warning)
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const register = useCallback((
    handler: Omit<BackButtonHandler, 'isActive'>
  ): (() => void) => {
    const id = handler.id;
    const newHandler: BackButtonHandler = { ...handler, isActive: true };

    setHandlers(prev => {
      const next = new Map(prev);
      next.set(id, newHandler);
      return next;
    });

    // Return cleanup function
    return () => {
      setHandlers(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const unregister = useCallback((id: string) => {
    setHandlers(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Stable function - reads from ref, doesn't depend on handlers state
  const getHighestPriorityHandler = useCallback((): BackButtonHandler | null => {
    let highest: BackButtonHandler | null = null;
    let highestPriority = 4; // Higher than max priority (3)

    handlersRef.current.forEach(handler => {
      if (handler.isActive && handler.priority < highestPriority) {
        highestPriority = handler.priority;
        highest = handler;
      }
    });

    return highest;
  }, []); // Empty deps - reads from ref, stable reference

  const registry = useMemo<BackButtonRegistry>(() => ({
    register,
    unregister,
    getHighestPriorityHandler,
  }), [register, unregister, getHighestPriorityHandler]);

  const contextValue = useMemo<BackButtonContextValue>(() => ({
    registry,
  }), [registry]);

  return (
    <BackButtonContext.Provider value={contextValue}>
      {children}
    </BackButtonContext.Provider>
  );
}

/**
 * Hook to access the back button registry.
 * Must be used within a BackButtonProvider.
 */
export function useBackButtonRegistry(): BackButtonRegistry {
  const context = useContext(BackButtonContext);
  if (!context) {
    throw new Error('useBackButtonRegistry must be used within a BackButtonProvider');
  }
  return context.registry;
}
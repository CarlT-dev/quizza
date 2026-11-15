import { useEffect, useRef } from 'react';
import { useBackButtonRegistry } from '@/shared/context/BackButtonContext';
import type { OverlayPriority } from '@/shared/types/backButton';

// Module-level counter for generating unique IDs without Math.random during render
let handlerIdCounter = 0;

/**
 * Hook for registering a component's close handler with the back button registry.
 * Automatically registers when isOpen=true and unregisters when isOpen=false or on unmount.
 *
 * @param priority - Priority level (1=highest for dialogs, 2=bottom sheets, 3=slide panels)
 * @param closeFn - Function to call when back button is pressed and this handler is highest priority
 * @param isOpen - Whether the overlay is currently open
 * @param id - Optional unique ID. If not provided, generates one using a counter.
 */
export function useBackButtonHandler(
  priority: OverlayPriority,
  closeFn: () => void,
  isOpen: boolean,
  id?: string
): void {
  const registry = useBackButtonRegistry();
  const handlerIdRef = useRef<string>(id ?? `overlay-${priority}-${++handlerIdCounter}`);
  const closeFnRef = useRef(closeFn);

  // Keep closeFnRef updated
  useEffect(() => {
    closeFnRef.current = closeFn;
  }, [closeFn]);

  // Register/unregister based on isOpen state.
  // The cleanup function runs both when isOpen becomes false AND on unmount.
  useEffect(() => {
    if (!isOpen) return;

    const currentHandlerId = handlerIdRef.current;
    const cleanup = registry.register({
      id: currentHandlerId,
      priority,
      close: () => closeFnRef.current(),
    });

    return () => {
      cleanup();
    };
  }, [isOpen, priority, registry]);
}
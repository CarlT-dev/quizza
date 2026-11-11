import { useEffect, useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { vibrate } from '../utils';

export const DEFAULT_LONG_PRESS_DELAY_MS = 450;

/** A press that wanders further than this is a scroll/drag, not a long-press. */
const MOVE_TOLERANCE_PX = 10;

export interface LongPressHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void;
}

/**
 * Long-press detection built on Pointer Events. One hook instance serves
 * every long-pressable element on the page: the handlers are attached to
 * multiple elements and identify the pressed one via `data-*` attributes
 * (ConvoPage's data-share-id dispatch).
 *
 * Fires once per press after `delayMs`; cancels on scroll (pointercancel or
 * movement beyond the tolerance), non-primary pointers, and leaving the
 * element. The click browsers synthesize after a fired long-press is
 * suppressed so it can't trigger the element's own onClick.
 *
 * `onPress` receives the element that was pressed. The callback is kept in a
 * latest ref so the returned handlers stay referentially stable.
 */
export function useLongPress(
  onPress: (target: HTMLElement) => void,
  delayMs: number = DEFAULT_LONG_PRESS_DELAY_MS
): LongPressHandlers {
  // Latest-ref pattern: handlers close over this ref, not the callback, so
  // they never need to be recreated when the caller's callback changes.
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const targetRef = useRef<HTMLElement | null>(null);
  // Set when the long-press fires, left set through pointerup so the trailing
  // click of the same gesture is swallowed, reset by the next pointerdown.
  const triggeredRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Drop a pending timer on unmount so onPress never fires from a dead gesture.
  useEffect(() => {
    return () => clearTimer();
  }, []);

  return useMemo(
    () => ({
      onPointerDown: event => {
        // Right-click, pen eraser, and a second concurrent finger are not long-presses.
        if (!event.isPrimary || event.button !== 0) return;
        clearTimer();
        triggeredRef.current = false;
        startXRef.current = event.clientX;
        startYRef.current = event.clientY;
        targetRef.current = event.currentTarget;
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          triggeredRef.current = true;
          vibrate();
          if (targetRef.current) {
            onPressRef.current(targetRef.current);
          }
        }, delayMs);
      },
      onPointerMove: event => {
        if (
          timerRef.current === null ||
          Math.hypot(event.clientX - startXRef.current, event.clientY - startYRef.current) <=
            MOVE_TOLERANCE_PX
        ) {
          return;
        }
        // The press turned into a scroll or drag — cancel it.
        clearTimer();
      },
      onPointerUp: () => {
        // Stop the pending timer only; triggeredRef stays set so this
        // gesture's trailing click is still suppressed.
        clearTimer();
      },
      onPointerLeave: () => {
        clearTimer();
        triggeredRef.current = false;
      },
      onPointerCancel: () => {
        // The browser took the pointer for scrolling (touch-action) — cancel.
        clearTimer();
        triggeredRef.current = false;
      },
      onContextMenu: event => {
        // Keep the OS long-press menu (Android) and the desktop right-click
        // menu from covering the app's own interaction.
        event.preventDefault();
      },
      onClickCapture: event => {
        if (!triggeredRef.current) return;
        // A long-press just fired for this gesture — the click browsers
        // synthesize on release must not reach the element's onClick.
        event.preventDefault();
        event.stopPropagation();
      },
    }),
    [delayMs]
  );
}

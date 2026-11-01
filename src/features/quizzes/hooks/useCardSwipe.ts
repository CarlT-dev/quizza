import { useState, useCallback, useRef, useEffect } from 'react';

interface UseCardSwipeOptions {
  onOpen?: () => void;
  onClose?: () => void;
  threshold?: number; // px to trigger open
  maxSwipe?: number;  // max swipe distance
  direction?: 'left' | 'right'; // swipe direction to open
}

interface UseCardSwipeResult {
  swipeOffset: number;
  isSwiping: boolean;
  isOpen: boolean;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
  };
  close: () => void;
  open: () => void;
}

export function useCardSwipe({
  onOpen,
  onClose,
  threshold = 80,
  maxSwipe = 200,
  direction = 'right',
}: UseCardSwipeOptions = {}): UseCardSwipeResult {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const startXRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Sync isOpen ref
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSwipeOffset(0);
    onClose?.();
  }, [onClose]);

  const open = useCallback(() => {
    setIsOpen(true);
    setSwipeOffset(direction === 'left' ? -maxSwipe : maxSwipe);
    onOpen?.();
  }, [onOpen, maxSwipe, direction]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isSwiping) return;
    startXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  }, [isSwiping]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping || startXRef.current === null) return;

    const currentX = e.touches[0].clientX;
    const deltaX = currentX - startXRef.current;

    // Only allow swipe in the specified direction
    const isCorrectDirection = direction === 'left' ? deltaX <= 0 : deltaX >= 0;
    if (!isCorrectDirection) {
      setSwipeOffset(0);
      return;
    }

    // Apply resistance when already open
    const effectiveMaxSwipe = isOpenRef.current ? maxSwipe + 50 : maxSwipe;
    const resistance = isOpenRef.current ? 0.5 : 1;
    const offset = Math.min(Math.abs(deltaX) * resistance, effectiveMaxSwipe);

    setSwipeOffset(direction === 'left' ? -offset : offset);
  }, [isSwiping, isOpen, maxSwipe, direction]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping || startXRef.current === null) {
      startXRef.current = null;
      setIsSwiping(false);
      return;
    }

    const shouldOpen = Math.abs(swipeOffset) >= threshold;

    if (shouldOpen && !isOpenRef.current) {
      open();
    } else if (!shouldOpen && isOpenRef.current) {
      close();
    } else {
      // Snap back to current state
      setSwipeOffset(isOpenRef.current ? (direction === 'left' ? -maxSwipe : maxSwipe) : 0);
    }

    startXRef.current = null;
    setIsSwiping(false);
  }, [isSwiping, swipeOffset, threshold, open, close, maxSwipe, direction]);

  // Mouse handlers for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isSwiping) return;
    startXRef.current = e.clientX;
    setIsSwiping(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isSwiping || startXRef.current === null) return;

      const currentX = moveEvent.clientX;
      const deltaX = currentX - startXRef.current;

      const isCorrectDirection = direction === 'left' ? deltaX <= 0 : deltaX >= 0;
      if (!isCorrectDirection) {
        setSwipeOffset(0);
        return;
      }

      const effectiveMaxSwipe = isOpenRef.current ? maxSwipe + 50 : maxSwipe;
      const resistance = isOpenRef.current ? 0.5 : 1;
      const offset = Math.min(Math.abs(deltaX) * resistance, effectiveMaxSwipe);

      setSwipeOffset(direction === 'left' ? -offset : offset);
    };

    const handleMouseUp = () => {
      if (!isSwiping || startXRef.current === null) return;

      const shouldOpen = Math.abs(swipeOffset) >= threshold;

      if (shouldOpen && !isOpenRef.current) {
        open();
      } else if (!shouldOpen && isOpenRef.current) {
        close();
      } else {
        setSwipeOffset(isOpenRef.current ? (direction === 'left' ? -maxSwipe : maxSwipe) : 0);
      }

      startXRef.current = null;
      setIsSwiping(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isSwiping, swipeOffset, threshold, open, close, maxSwipe, direction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    swipeOffset,
    isSwiping,
    isOpen,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
    },
    close,
    open,
  };
}
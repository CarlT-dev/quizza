import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

interface UseMessageScrollOptions {
  /** Threshold in pixels from bottom to consider "near bottom" */
  threshold?: number;
  /** Dependency that triggers initial scroll (e.g., messages array) */
  triggerDeps?: unknown[];
  /** Key that identifies the current conversation - resets scroll when changed */
  conversationKey?: string;
}

interface UseMessageScrollReturn {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the user has scrolled up away from the bottom */
  hasScrolledUp: boolean;
  /** Whether the user is currently near the bottom of the container */
  isNearBottom: boolean;
  /** Scroll to the bottom of the container */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Reset scroll position for a new conversation */
  resetScrollPosition: () => void;
  /** Handler to attach to the container's onScroll event */
  handleScroll: () => void;
}

/**
 * Hook for managing Messenger-like scroll behavior in a conversation view.
 *
 * Features:
 * - Auto-scroll to bottom on initial load / conversation switch
 * - Track user scroll position to avoid interrupting reading
 * - Auto-scroll on new messages only when user is near bottom
 * - Handle dynamic content height changes (images, attachments)
 * - Reset scroll position when conversation changes
 */
export function useMessageScroll(options: UseMessageScrollOptions = {}): UseMessageScrollReturn {
  const { threshold = 100, triggerDeps = [], conversationKey } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasScrolledUp, setHasScrolledUp] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Refs for tracking state without causing re-renders
  const hasInitializedRef = useRef(false);
  const previousConversationKeyRef = useRef<string | undefined>(conversationKey);
  const previousTriggerDepsLengthRef = useRef(triggerDeps.length);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Create a stable dependency key from triggerDeps for useEffect dependencies
  // Using useMemo to avoid "complex expression in dependency array" lint warning
  // and "accessing refs during render" warning
  const triggerDepsKey = useMemo(
    () => JSON.stringify(triggerDeps),
    [triggerDeps]
  );

  /**
   * Check if the container is near the bottom (within threshold)
   */
  const checkNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true; // Default to true if no container

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= threshold;
  }, [threshold]);

  /**
   * Scroll to the bottom of the container
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'instant') => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  /**
   * Handle scroll events - update hasScrolledUp and isNearBottom
   */
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // User has scrolled up if they're more than threshold away from bottom
    const scrolledUp = distanceFromBottom > threshold;
    const nearBottom = distanceFromBottom <= threshold;

    setHasScrolledUp(scrolledUp);
    setIsNearBottom(nearBottom);
  }, [threshold]);

  /**
   * Reset scroll position for a new conversation
   */
  const resetScrollPosition = useCallback(() => {
    setHasScrolledUp(false);
    setIsNearBottom(true);
    hasInitializedRef.current = false;
    // Scroll will happen in the initialization effect
  }, []);

  /**
   * Effect 1: Handle conversation switching
   * When conversationKey changes, reset scroll position
   */
  useEffect(() => {
    if (previousConversationKeyRef.current !== conversationKey) {
      previousConversationKeyRef.current = conversationKey;
      resetScrollPosition();
    }
  }, [conversationKey, resetScrollPosition]);

  /**
   * Effect 2: Initial scroll to bottom after render
   * Uses useLayoutEffect to run after DOM mutations but before paint
   * Uses requestAnimationFrame to ensure render is complete
   */
  useEffect(() => {
    // Only run initial scroll once per conversation
    if (hasInitializedRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Wait for the next frame to ensure messages are rendered
    requestAnimationFrame(() => {
      // Double-check container still exists and we haven't initialized
      if (!containerRef.current || hasInitializedRef.current) return;

      scrollToBottom('instant');
      hasInitializedRef.current = true;
    });
  }, [scrollToBottom, triggerDepsKey]);

  /**
   * Effect 3: Auto-scroll on new messages
   * Triggered when triggerDeps length increases (new messages arrived)
   * Only scrolls if user is near bottom and hasn't scrolled up
   */
  useEffect(() => {
    // Skip on initial load (handled by Effect 2)
    if (triggerDeps.length <= previousTriggerDepsLengthRef.current) {
      previousTriggerDepsLengthRef.current = triggerDeps.length;
      return;
    }

    previousTriggerDepsLengthRef.current = triggerDeps.length;

    // Only auto-scroll if user is near bottom and hasn't intentionally scrolled up
    if (isNearBottom && !hasScrolledUp) {
      // Use requestAnimationFrame to ensure new message is rendered
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    }
  }, [triggerDeps.length, isNearBottom, hasScrolledUp, scrollToBottom]);

  /**
   * Effect 4: ResizeObserver for dynamic content heights
   * Handles images, attachments, or other content that loads after initial render
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create ResizeObserver to detect container height changes
    const observer = new ResizeObserver(() => {
      // If user is near bottom, maintain that position by scrolling to bottom
      if (isNearBottom) {
        // Use instant scroll to avoid animation during content loading
        requestAnimationFrame(() => {
          scrollToBottom('instant');
        });
      }
      // Re-check near-bottom status after resize
      const nearBottom = checkNearBottom();
      setIsNearBottom(nearBottom);
    });

    resizeObserverRef.current = observer;
    observer.observe(container);

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [checkNearBottom, isNearBottom, scrollToBottom]);

  /**
   * Effect 5: Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, []);

  return {
    containerRef,
    hasScrolledUp,
    isNearBottom,
    scrollToBottom,
    resetScrollPosition,
    handleScroll,
  };
}
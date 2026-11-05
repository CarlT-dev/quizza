import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface BottomSheetProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Panel content */
  children: React.ReactNode;
  /** Panel title (for accessibility and header) */
  title?: string;
  /** Whether to show close button in header */
  showCloseButton?: boolean;
  /** Custom className for panel */
  className?: string;
  /** Custom className for content area */
  contentClassName?: string;
}

type AnimationPhase = 'closed' | 'opening' | 'open' | 'closing';

/**
 * Global Bottom Sheet Component
 * Slides up from the bottom edge to half screen height, with rounded top
 * corners. Full width on mobile, centered to the app's content width on
 * desktop. Closes via the X button, the backdrop, or the caller's own
 * action — deliberately no ESC / swipe handling (product decision).
 * Same phase-based animation, scroll lock and focus management as
 * SlidePanel, so both overlays behave identically.
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title = 'Panel',
  showCloseButton = true,
  className = '',
  contentClassName = '',
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<AnimationPhase>('closed');

  // Sync internal phase with isOpen prop. The timers only advance the phase
  // (opening→open, closing→closed), so re-running on `phase` is unnecessary —
  // and re-running on every phase change is what trips set-state-in-effect.
  useEffect(() => {
    if (isOpen) {
      setPhase('opening');
      // After opening animation, set to open
      const openTimer = setTimeout(() => setPhase('open'), 300);
      return () => clearTimeout(openTimer);
    }
    if (phase !== 'closed') {
      setPhase('closing');
      // After closing animation, set to closed (unmount)
      const closeTimer = setTimeout(() => setPhase('closed'), 300);
      return () => clearTimeout(closeTimer);
    }
  }, [isOpen, phase]);

  // Focus management and body scroll lock
  useEffect(() => {
    if (phase === 'opening' || phase === 'open') {
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Lock body scroll
      document.body.style.overflow = 'hidden';

      // Focus the panel for accessibility
      setTimeout(() => {
        panelRef.current?.focus();
      }, 0);
    } else {
      // Restore body scroll
      document.body.style.overflow = '';

      // Restore focus to trigger element
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [phase]);

  if (phase === 'closed') return null;

  const isClosing = phase === 'closing';
  const panelAnimation = isClosing ? 'animate-slide-out-down' : 'animate-slide-in-up';
  const backdropAnimation = isClosing ? 'animate-fade-out' : 'animate-fade-in';

  return (
    <>
      {/* Backdrop Overlay — tapping outside closes */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 ${backdropAnimation}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet — anchored to the bottom, half screen, rounded top */}
      <div
        ref={panelRef}
        className={`fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-[500px] h-[50dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-xl flex flex-col ${panelAnimation} ${className}`}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="sm"
              className="p-1"
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()}`}
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${contentClassName}`}>{children}</div>
      </div>
    </>
  );
}

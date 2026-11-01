import { useEffect, useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface SlidePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Panel content */
  children: React.ReactNode;
  /** Panel title (for accessibility) */
  title?: string;
  /** Panel width on desktop (default: full width on mobile, 400px on desktop) */
  width?: string;
  /** Whether to show close button in header */
  showCloseButton?: boolean;
  /** Custom className for panel */
  className?: string;
  /** Custom className for content area */
  contentClassName?: string;
  /** Custom className for header */
  headerClassName?: string;
}

type AnimationPhase = 'closed' | 'opening' | 'open' | 'closing';

/**
 * Global Slide Panel Component
 * Slides in from the right side of the screen
 * Full width on mobile, configurable width on desktop
 * Includes backdrop overlay and accessibility features
 * Uses CSS animations for smooth slide in/out transitions
 */
export function SlidePanel({
  isOpen,
  onClose,
  children,
  title = 'Panel',
  width = 'w-full sm:w-[400px] lg:w-[480px]',
  showCloseButton = true,
  className = '',
  contentClassName = '',
  headerClassName = '',
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<AnimationPhase>('closed');

  // Handle escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Handle outside click (on backdrop)
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // Sync internal phase with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setPhase('opening');
      // After opening animation, set to open
      setTimeout(() => setPhase('open'), 300);
    } else if (phase !== 'closed') {
      setPhase('closing');
      // After closing animation, set to closed (unmount)
      setTimeout(() => setPhase('closed'), 300);
    }
  }, [isOpen, phase]);

  // Focus management and body scroll lock
  useEffect(() => {
    if (phase === 'opening' || phase === 'open') {
      // Store previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Lock body scroll
      document.body.style.overflow = 'hidden';

      // Add escape key listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the panel for accessibility
      setTimeout(() => {
        panelRef.current?.focus();
      }, 0);
    } else {
      // Restore body scroll
      document.body.style.overflow = '';

      // Remove escape key listener
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to trigger element
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [phase, handleKeyDown]);

  if (phase === 'closed') return null;

  const isClosing = phase === 'closing';
  const panelAnimation = isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right';
  const backdropAnimation = isClosing ? 'animate-fade-out' : 'animate-fade-in';

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 ${backdropAnimation}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Slide Panel */}
      <aside
        ref={panelRef}
        className={`fixed right-0 top-0 h-full ${width} max-w-full bg-white dark:bg-gray-800 shadow-xl z-50 ${panelAnimation} ${className}`}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${headerClassName}`}>
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
        <div className={`flex-1 overflow-y-auto ${contentClassName}`}>
          {children}
        </div>
      </aside>
    </>
  );
}
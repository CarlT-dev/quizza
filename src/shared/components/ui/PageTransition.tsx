interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Page transition wrapper - does NOT force remount on navigation.
 * Use this for instant navigation without React remount overhead.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

/**
 * AnimatePage - same as PageTransition but intended for CSS-based animations.
 * Add animation classes (e.g., animate-slide-in-right) to the className prop
 * for enter animations without forcing remount.
 */
export function AnimatePage({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
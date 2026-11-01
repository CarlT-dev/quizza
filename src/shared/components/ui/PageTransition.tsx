import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple no-animation page transition - just renders children
 * Avoids Framer Motion layout issues
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div key={location.pathname} className={className}>
      {children}
    </div>
  );
}

/**
 * Simpler alternative: AnimatePage that just animates on mount/unmount
 * using CSS classes for better performance
 */
interface AnimatePageProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatePage({ children, className = '' }: AnimatePageProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
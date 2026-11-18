import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  WifiOff,
  X
} from 'lucide-react';

type ToastType = 'info' | 'success' | 'warning' | 'error' | 'offline';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
  persistent?: boolean;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Icon component mapping for each toast type
 */
const iconMap: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  offline: WifiOff,
};

/**
 * Background color classes for each toast type
 */
const bgColors: Record<ToastType, string> = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  offline: 'bg-amber-600',
};

/**
 * Individual toast item component
 */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = iconMap[toast.type];

  return (
    <div
      className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-xl shadow-lg w-full max-w-sm animate-slide-up flex items-start gap-3`}
      role="alert"
      aria-live={toast.type === 'offline' ? 'assertive' : 'polite'}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => { toast.action?.onClick(); onDismiss(toast.id); }}
            className="mt-2 text-xs underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-amber-600 rounded"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-white/70 hover:text-white p-2 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-amber-600 rounded"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * ToastProvider - wraps the app and provides global toast functionality
 */
interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const fullToast: Toast = { ...toast, id };

    setToasts(prev => [...prev, fullToast]);

    // Auto-dismiss non-persistent toasts
    if (!toast.persistent && (toast.duration ?? 4000) > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, toast.duration ?? 4000);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: ToastContextValue = { show, dismiss, toasts };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container - fixed bottom right */}
      <div
        className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 items-end sm:max-w-md pointer-events-none"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto w-full">
            <ToastItem toast={toast} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast functionality from any component
 * Must be used within a ToastProvider
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
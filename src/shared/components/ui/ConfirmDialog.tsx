import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

type AnimationPhase = 'closed' | 'opening' | 'open' | 'closing';

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  isLoading = false,
  error = null,
  onConfirm,
  onCancel
}) => {
  const [phase, setPhase] = useState<AnimationPhase>('closed');

  // Sync internal phase with isOpen prop
  useEffect(() => {
    if (isOpen) {
      setPhase('opening');
      const openTimer = setTimeout(() => setPhase('open'), 200);
      return () => clearTimeout(openTimer);
    }
    if (phase !== 'closed') {
      setPhase('closing');
      const closeTimer = setTimeout(() => setPhase('closed'), 200);
      return () => clearTimeout(closeTimer);
    }
  }, [isOpen, phase]);

  if (phase === 'closed') return null;

  const isClosing = phase === 'closing';
  const dialogAnimation = isClosing ? 'animate-pop-out' : 'animate-pop-in';
  const backdropAnimation = isClosing ? 'animate-fade-out' : 'animate-fade-in';

  return (
    <>
      {/* Backdrop Overlay — blurs background only */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm ${backdropAnimation}`}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog Wrapper — centers the dialog, no blur */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Dialog — centered, scales in/out with fade */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 max-w-sm w-full ${dialogAnimation}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-message"
        >
          <h2 id="dialog-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h2>
          <p id="dialog-message" className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>

          {error && (
            <div className="flex items-center text-red-600 dark:text-red-400 mb-4" role="alert">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button onClick={onCancel} disabled={isLoading} variant="secondary" className="w-full">
              {cancelLabel}
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              variant={destructive ? 'destructive' : undefined}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
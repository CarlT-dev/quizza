import { memo } from 'react';
import { Check, Palette } from 'lucide-react';
import { CARD_COLORS, type CardColorId } from '@/features/quiz/api/quiz';

interface ColorPaletteProps {
  selectedColor: CardColorId;
  onColorChange: (colorId: CardColorId) => void;
  className?: string;
  variant?: 'modal' | 'inline';
}

export const ColorPalette = memo(function ColorPalette({
  selectedColor,
  onColorChange,
  className = '',
  variant = 'modal',
}: ColorPaletteProps) {
  if (variant === 'inline') {
    return (
      <div
        className={`grid grid-cols-3 gap-3 px-4 py-3 ${className}`}
        role="listbox"
        aria-label="Choose card color"
      >
        {CARD_COLORS.map((color) => {
          const isSelected = selectedColor === color.id;

          return (
            <button
              key={color.id}
              type="button"
              onClick={() => onColorChange(color.id)}
              className={`
                flex-shrink-0 w-12 h-12 rounded-xl border-2 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                ${isSelected
                  ? 'border-primary-500 scale-110 shadow-lg shadow-primary-500/25'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:scale-105'
                }
                ${color.bgClass}
              `}
              aria-pressed={isSelected}
              aria-label={color.name}
              role="option"
            >
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-6 h-6 text-white drop-shadow-lg" aria-hidden="true" />
                </div>
              )}
              <span className="sr-only">{color.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4 ${className}`}
      role="dialog"
      aria-label="Choose card color"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={() => onColorChange(selectedColor)}
        aria-hidden="true"
      />

      {/* Palette Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary-500" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Card Color</h3>
          </div>
          <button
            type="button"
            onClick={() => onColorChange(selectedColor)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Color Options */}
        <div className="grid grid-cols-3 gap-3">
          {CARD_COLORS.map((color) => {
            const isSelected = selectedColor === color.id;

            return (
              <button
                key={color.id}
                type="button"
                onClick={() => onColorChange(color.id)}
                className={`
                  relative aspect-square rounded-xl border-2 transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  ${isSelected
                    ? 'border-primary-500 scale-105 shadow-lg shadow-primary-500/25'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:scale-105'
                  }
                  ${color.bgClass}
                `}
                aria-pressed={isSelected}
                aria-label={color.name}
              >
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-6 h-6 text-white drop-shadow-lg" aria-hidden="true" />
                  </div>
                )}
                <span className="sr-only">{color.name}</span>
              </button>
            );
          })}
        </div>

        {/* Description */}
        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Swipe right on a quiz card to open this palette. Your choice syncs across devices.
        </p>
      </div>
    </div>
  );
});
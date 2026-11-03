import { memo } from 'react';

type StatTone = 'green' | 'red' | 'primary';

/**
 * The stat-tile recipe extracted from ScorePage's score grid
 * (bg-*-50 / dark:bg-*-900/20 container, bold value, xs label).
 * Literal class strings so Tailwind v4 sees them.
 */
const TONE_CLASSES: Record<StatTone, { container: string; value: string; label: string }> = {
  green: {
    container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    value: 'text-green-600 dark:text-green-400',
    label: 'text-green-700 dark:text-green-300',
  },
  red: {
    container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    value: 'text-red-600 dark:text-red-400',
    label: 'text-red-700 dark:text-red-300',
  },
  primary: {
    container: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800',
    value: 'text-primary-600 dark:text-primary-400',
    label: 'text-primary-700 dark:text-primary-300',
  },
};

interface StatTileProps {
  value: string | number;
  label: string;
  tone?: StatTone;
}

/** Single centered stat tile (value + label) used by Score and Status grids. */
export const StatTile = memo(function StatTile({ value, label, tone = 'primary' }: StatTileProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <div className={`p-4 rounded-xl border text-center ${classes.container}`}>
      <div className={`text-2xl font-bold ${classes.value}`}>{value}</div>
      <div className={`text-xs ${classes.label}`}>{label}</div>
    </div>
  );
});

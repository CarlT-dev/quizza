import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  /** Border color variant */
  borderColor?: 'primary' | 'gray' | 'transparent' | string;
  /** Background color variant */
  bgColor?: 'default' | 'muted' | 'transparent' | string;
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(
  (
    {
      children,
      borderColor = 'gray',
      bgColor = 'default',
      className = '',
      ...props
    },
    ref
  ) => {
    const borderStyles = {
      primary: 'border-primary-300 dark:border-primary-700',
      gray: 'border-gray-200 dark:border-gray-700',
      transparent: 'border-transparent',
    };

    const bgStyles = {
      default: 'bg-inheret dark:bg-gray-800',
      muted: 'bg-gray-50 dark:bg-gray-900/50',
      transparent: 'bg-transparent',
    };

    const borderColorClass = borderStyles[borderColor as keyof typeof borderStyles] ?? borderColor;
    const bgColorClass = bgStyles[bgColor as keyof typeof bgStyles] ?? bgColor;

    return (
      <div
        ref={ref}
        className={`border-t border-b ${borderColorClass} ${bgColorClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Box.displayName = 'Box';

export const BoxTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ children, className = '', ...props }, ref) => (
    <h3 ref={ref} className={`px-6 py-4 text-lg font-semibold text-gray-900 dark:text-gray-100 ${className}`} {...props}>
      {children}
    </h3>
  )
);
BoxTitle.displayName = 'BoxTitle';

export const BoxContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  )
);
BoxContent.displayName = 'BoxContent';
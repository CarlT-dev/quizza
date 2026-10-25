import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  type LucideIcon,
} from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: string;
}

const iconMap: Record<string, LucideIcon> = {
  mail: Mail,
  lock: Lock,
  user: User,
  username: User,
  profile: User,
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, icon, type, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    const getIcon = () => {
      if (!icon) return null;
      const IconComponent = iconMap[icon.toLowerCase()];
      if (!IconComponent) {
        console.warn(`Icon "${icon}" not found in icon map. Available icons: ${Object.keys(iconMap).join(', ')}`);
        return null;
      }
      return <IconComponent className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />;
    };

    const handleTogglePassword = () => {
      setShowPassword(!showPassword);
    };

    return (
      <div className="w-full">
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {getIcon()}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            className={`
              w-full py-2.5 rounded-lg border transition-colors
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${icon ? 'pl-10' : 'px-4'}
              pr-10
              ${error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
              ${className}
            `}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={handleTogglePassword}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Eye className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { type LoginFormData, type LoginFormErrors, validateLogin, isLoginValid } from '@/shared/validations/login';
import { loginUser } from '../api/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginFormData>({
    identifier: '',
    password: '',
  });
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors = validateLogin(formData);
    setErrors(newErrors);
    return isLoginValid(formData);
  };

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    const result = await loginUser(formData);

    if (result.success) {
      navigate('/');
    } else {
      setIsSubmitting(false);
      // Show API authentication errors at the top (submitError), not on input fields
      setSubmitError(result.error?.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="flex flex-col items-center text-center mb-8">
        <img
          src="/logo%20quizza.png"
          alt="Quizza logo"
          className="w-24 h-24 object-contain mb-3"
        />
        <h1 className="text-5xl font-extrabold text-primary-700 dark:text-gray-100">Quizza</h1>
      </div>

      {/* Welcome text */}
      <div className="space-y-1 mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Welcome back!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Login to continue</p>
      </div>

      {submitError && (
        <div
          className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm"
          role="alert"
          aria-live="polite"
        >
          {submitError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="Email or Username"
          type="text"
          placeholder="Email or username"
          value={formData.identifier}
          onChange={e => handleInputChange('identifier', e.target.value)}
          error={errors.identifier}
          required
          autoComplete="username"
          autoFocus
          icon="mail"
        />

        <Input
          label="Password"
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={e => handleInputChange('password', e.target.value)}
          error={errors.password}
          required
          autoComplete="current-password"
          icon="lock"
        />

        {/* Forgot password */}
        <div className="text-right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="p-0"
            onClick={() => navigate('/forgot-password')}
          >
            Forgot password?
          </Button>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={isSubmitting}
        >
          Login
        </Button>
      </form>

      {/* Don't have account */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Don't have an account?{' '}
        <a
          href="/register"
          className="text-primary-500 hover:text-primary-600 hover:underline font-medium"
          onClick={(e) => { e.preventDefault(); navigate('/register'); }}
        >
          Register
        </a>
      </p>
    </div>
  );
}
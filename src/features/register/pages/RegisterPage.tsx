import { useState, type FormEvent, type KeyboardEvent, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { registerUser, type RegisterData } from '../api/auth';

interface FormData {
  // Part 1
  email: string;
  password: string;
  confirmPassword: string;
  // Part 2
  username: string;
  // Part 3
  name: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
  name?: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    name: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Refs for focus management
  const emailInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus first input on step change
  useEffect(() => {
    if (step === 1) {
      emailInputRef.current?.focus();
    } else if (step === 2) {
      usernameInputRef.current?.focus();
    } else {
      nameInputRef.current?.focus();
    }
  }, [step]);

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 20) {
      newErrors.username = 'Username must be at most 20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 1) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Name must be at most 50 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleStep1Submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // First run client-side validation
    if (!validateStep1()) return;

    // Proceed to step 2 (email existence will be checked during registration)
    setStep(2);
    setErrors({});
  };

  const handleStep2Submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateStep2()) return;

    // Proceed to step 3
    setStep(3);
    setErrors({});
  };

  const handleStep3Submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateStep3()) return;

    setIsSubmitting(true);

    const registerData: RegisterData = {
      email: formData.email,
      password: formData.password,
      username: formData.username,
      name: formData.name,
    };

    const result = await registerUser(registerData);

    if (result.success) {
      navigate('/');
    } else {
      setIsSubmitting(false);

      // If email already exists, go back to step 1 and show error on email field
      if (result.error?.code === 'auth/email-already-in-use') {
        setStep(1);
        setErrors({ email: result.error.message });
        // Focus email input
        emailInputRef.current?.focus();
        return;
      }

      if (result.error?.field) {
        setErrors({ [result.error.field]: result.error.message });
      } else {
        setSubmitError(result.error?.message || 'Registration failed. Please try again.');
      }
    }
  };

  const handleBackToStep1 = () => {
    setStep(1);
    setErrors({});
    setSubmitError(null);
  };

  const handleBackToStep2 = () => {
    setStep(2);
    setErrors({});
    setSubmitError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>, onSubmit: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      // Don't submit on Enter if target is a textarea or button
      if (target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON') {
        e.preventDefault();
        onSubmit();
      }
    }
  };

  return (
    <div className="relative space-y-6 p-6 pb-20">
      {/* Back button - absolute, before progress indicator */}
      {(step === 2 || step === 3) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={step === 2 ? handleBackToStep1 : handleBackToStep2}
          className="absolute top-0 left-0 p-2"
          aria-label={step === 2 ? 'Back to step 1' : 'Back to step 2'}
          disabled={isSubmitting}
        >
          <ChevronLeft className="w-8 h-8" aria-hidden="true" />
        </Button>
      )}

      {/* Progress indicator */}
      <nav aria-label="Registration progress" className="mb-6">
        <ol className="flex items-center justify-center" role="list">
          <li className="flex items-center">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                step >= 1
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
              aria-current={step === 1 ? 'step' : undefined}
            >
              1
            </span>
            <span className="sr-only">Step 1: Account Credentials</span>
          </li>
          <li className="flex-1 max-w-16 mx-4">
            <div
              className={`h-0.5 w-full rounded transition-colors ${
                step >= 2 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-hidden="true"
            />
          </li>
          <li className="flex items-center">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                step >= 2
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
              aria-current={step === 2 ? 'step' : undefined}
            >
              2
            </span>
            <span className="sr-only">Step 2: Username</span>
          </li>
          <li className="flex-1 max-w-16 mx-4">
            <div
              className={`h-0.5 w-full rounded transition-colors ${
                step >= 3 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-hidden="true"
            />
          </li>
          <li className="flex items-center">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                step >= 3
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
              aria-current={step === 3 ? 'step' : undefined}
            >
              3
            </span>
            <span className="sr-only">Step 3: Name</span>
          </li>
        </ol>
        <div className="flex justify-center gap-14 text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span>Account</span>
          <span>Username</span>
          <span>Name</span>
        </div>
      </nav>

      {submitError && (
        <div
          className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm"
          role="alert"
          aria-live="polite"
        >
          {submitError}
        </div>
      )}

      {/* Step 1: Account Credentials */}
      {step === 1 && (
        <>
          <form
            onSubmit={handleStep1Submit}
            className="space-y-5"
            onKeyDown={e => handleKeyDown(e, () => handleStep1Submit(e))}
            noValidate
          >
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-semibold text-text-primary dark:text-gray-100">Create Account</h1>
              <p className="text-sm text-text-primary dark:text-gray-400">Enter your credentials</p>
            </div>

            <Input
              ref={emailInputRef}
              label="Email"
              type="email"
              placeholder="Email address"
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              error={errors.email}
              required
              autoComplete="email"
              icon="mail"
              aria-describedby={errors.email ? 'email-error' : undefined}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={e => handleInputChange('password', e.target.value)}
              error={errors.password}
              required
              autoComplete="new-password"
              icon="lock"
              helperText="At least 8 characters"
              aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={e => handleInputChange('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
              icon="lock"
              aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Continue
            </Button>

          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <a
              href="/login"
              className="text-primary-500 hover:text-primary-600 hover:underline font-medium"
              onClick={(e) => { e.preventDefault(); navigate('/login'); }}
            >
              Login
            </a>
          </p>
        </>
      )}

      {/* Step 2: Profile Information */}
      {step === 2 && (
        <>

          <form
            onSubmit={handleStep2Submit}
            className="space-y-5"
            onKeyDown={e => handleKeyDown(e, () => handleStep2Submit(e))}
            noValidate
          >
            <div className="text-center space-y-1 pt-2">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create Account</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose your username</p>
            </div>

            <Input
              ref={usernameInputRef}
              label="Username"
              type="text"
              placeholder="johndoe"
              value={formData.username}
              onChange={e => handleInputChange('username', e.target.value)}
              error={errors.username}
              required
              autoComplete="username"
              icon="user"
              helperText="3-20 characters, letters, numbers, underscores"
              aria-describedby={errors.username ? 'username-error' : 'username-hint'}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Continue
            </Button>

          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-primary-500 hover:text-primary-600 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
            >
              Sign in
            </button>
          </p>
        </>
      )}

      {/* Step 3: Name */}
      {step === 3 && (
        <>
          <form
            onSubmit={handleStep3Submit}
            className="space-y-5"
            onKeyDown={e => handleKeyDown(e, () => handleStep3Submit(e))}
            noValidate
          >
            <div className="text-center space-y-1 pt-2">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create Account</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">What should we call you?</p>
            </div>

            <Input
              ref={nameInputRef}
              label="Name"
              type="text"
              placeholder="John Doe"
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              error={errors.name}
              required
              autoComplete="name"
              icon="user"
              helperText="1-50 characters"
              aria-describedby={errors.name ? 'name-error' : 'name-hint'}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Confirm
            </Button>

          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-primary-500 hover:text-primary-600 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
            >
              Sign in
            </button>
          </p>
        </>
      )}
    </div>
  );
}
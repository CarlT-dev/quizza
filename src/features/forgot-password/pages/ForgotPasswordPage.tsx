import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';

interface FormData {
  email: string;
}

interface FormErrors {
  email?: string;
}

interface FormState {
  success?: string;
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({ email: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [state, setState] = useState<FormState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});
    setState({});

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setState({ success: 'Password reset email sent! Check your inbox.' });
      setFormData({ email: '' });
    } catch (error: unknown) {
      setIsSubmitting(false);
      const err = error as { code?: string; message?: string };

      if (err.code === 'auth/user-not-found') {
        setErrors({ email: 'No account found with this email' });
      } else if (err.code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email format' });
      } else if (err.code === 'auth/too-many-requests') {
        setErrors({ email: 'Too many attempts. Please try again later.' });
      } else {
        setErrors({ email: 'Failed to send reset email. Please try again.' });
      }
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto p-6 pb-20">
      {/* Logo */}
      <div className="flex flex-col items-center text-center mb-8">
        <img
          src="/logo.png"
          alt="Quizza logo"
          className="w-24 h-24 object-contain mb-3"
        />
        <h1 className="text-2xl font-bold text-text-primary dark:text-gray-100">Quizza</h1>
      </div>

      {/* Title */}
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-2xl font-semibold text-text-primary dark:text-gray-100">Forgot Password?</h2>
        <p className="text-sm text-text-primary dark:text-gray-400">Enter your email to receive a reset link</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={e => handleInputChange('email', e.target.value)}
          error={errors.email}
          required
          autoComplete="email"
          autoFocus
          icon="mail"
        />

        {state.success && (
          <div className="text-center text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            {state.success}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={isSubmitting}
        >
          Send Reset Link
        </Button>
      </form>

      {/* Back to login */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Remember your password?{' '}
        <a
          href="/login"
          className="text-primary-500 hover:text-primary-600 hover:underline font-medium"
          onClick={(e) => { e.preventDefault(); navigate('/login'); }}
        >
          Back to Login
        </a>
      </p>
    </div>
  );
}
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;

export interface FieldError {
  message: string;
}

export type Validator<T> = (value: T) => FieldError | null;

export const required: Validator<string> = (value) =>
  value.trim() ? null : { message: 'This field is required' };

export const email: Validator<string> = (value) =>
  EMAIL_REGEX.test(value) ? null : { message: 'Invalid email format' };

export const minLength = (min: number): Validator<string> => (value) =>
  value.length >= min ? null : { message: `Must be at least ${min} characters` };

export const maxLength = (max: number): Validator<string> => (value) =>
  value.length <= max ? null : { message: `Must be at most ${max} characters` };

export const pattern = (regex: RegExp, message: string): Validator<string> => (value) =>
  regex.test(value) ? null : { message };

export const username: Validator<string> = (value) => {
  if (!value.trim()) return { message: 'Username is required' };
  if (value.length < USERNAME_MIN_LENGTH) return { message: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  if (value.length > USERNAME_MAX_LENGTH) return { message: `Username must be at most ${USERNAME_MAX_LENGTH} characters` };
  if (!USERNAME_REGEX.test(value)) return { message: 'Username can only contain letters, numbers, and underscores' };
  return null;
};

export const password: Validator<string> = (value) => {
  if (!value) return { message: 'Password is required' };
  if (value.length < PASSWORD_MIN_LENGTH) return { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  return null;
};

export const confirmPassword = (getPassword: () => string): Validator<string> => (value) => {
  if (!value) return { message: 'Please confirm your password' };
  if (value !== getPassword()) return { message: 'Passwords do not match' };
  return null;
};

export const compose = <T>(...validators: Validator<T>[]): Validator<T> => (value) => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};

export const validateField = <T>(value: T, validator: Validator<T>): string | undefined => {
  const error = validator(value);
  return error?.message;
};

export const validateFields = <T extends Record<string, unknown>>(
  values: T,
  validators: Partial<Record<keyof T, Validator<T[keyof T]>>>
): Partial<Record<keyof T, string>> => {
  const errors: Partial<Record<keyof T, string>> = {};
  (Object.keys(validators) as Array<keyof T>).forEach((key) => {
    const validator = validators[key];
    if (validator) {
      const error = validateField(values[key], validator);
      if (error) errors[key] = error;
    }
  });
  return errors;
};
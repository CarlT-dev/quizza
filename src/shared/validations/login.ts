import {
  email,
  password,
  required,
} from './fields';

export interface LoginFormData {
  identifier: string;
  password: string;
}

export interface LoginFormErrors {
  identifier?: string;
  password?: string;
}

/**
 * Validates identifier as either email or username
 * Username: 3-20 chars, alphanumeric and underscore
 * Email: standard email format
 */
function validateIdentifier(value: string) {
  const err = required(value);
  if (err) return err;

  // Check if it's an email format
  if (value.includes('@')) {
    return email(value);
  }

  // Otherwise validate as username
  if (value.length < 3) {
    return { message: 'Username must be at least 3 characters' };
  }
  if (value.length > 20) {
    return { message: 'Username must be at most 20 characters' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return { message: 'Username can only contain letters, numbers, and underscores' };
  }

  return null;
}

const loginValidators = {
  identifier: (value: string) => validateIdentifier(value),
  password: (value: string) => password(value),
};

export const validateLogin = (formData: LoginFormData): LoginFormErrors => {
  const errors: LoginFormErrors = {};

  const identifierError = loginValidators.identifier(formData.identifier);
  if (identifierError) errors.identifier = identifierError.message;

  const passwordError = loginValidators.password(formData.password);
  if (passwordError) errors.password = passwordError.message;

  return errors;
};

export const isLoginValid = (formData: LoginFormData): boolean => {
  return Object.keys(validateLogin(formData)).length === 0;
};
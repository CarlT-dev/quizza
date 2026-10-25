import {
  email,
  password,
  confirmPassword,
  username,
  required,
} from './fields';

export interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}

export interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
}

const step1Validators = {
  email: (value: string) => {
    const err = required(value);
    return err || email(value);
  },
  password: (value: string) => password(value),
  confirmPassword: (value: string, formData: FormData) => {
    const err = required(value);
    return err || confirmPassword(() => formData.password)(value);
  },
};

const step2Validators = {
  username: (value: string) => username(value),
};

export const validateStep1 = (formData: FormData): FormErrors => {
  const errors: FormErrors = {};

  const emailError = step1Validators.email(formData.email);
  if (emailError) errors.email = emailError.message;

  const passwordError = step1Validators.password(formData.password);
  if (passwordError) errors.password = passwordError.message;

  const confirmError = step1Validators.confirmPassword(formData.confirmPassword, formData);
  if (confirmError) errors.confirmPassword = confirmError.message;

  return errors;
};

export const validateStep2 = (formData: FormData): FormErrors => {
  const errors: FormErrors = {};

  const usernameError = step2Validators.username(formData.username);
  if (usernameError) errors.username = usernameError.message;

  return errors;
};

export const isStep1Valid = (formData: FormData): boolean => {
  return Object.keys(validateStep1(formData)).length === 0;
};

export const isStep2Valid = (formData: FormData): boolean => {
  return Object.keys(validateStep2(formData)).length === 0;
};
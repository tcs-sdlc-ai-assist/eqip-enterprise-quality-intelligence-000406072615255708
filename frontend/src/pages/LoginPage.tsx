import { useState, useCallback } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Shield } from 'lucide-react';

// ---------------------------------------------------------------------------
// LoginPage — full-page centered login form (no sidebar / header).
//
// Uses the AuthContext login() which calls POST /auth/login. On success the
// user is navigated to /dashboard. Inline validation for required fields and
// email format; server errors are shown via the Alert component.
// ---------------------------------------------------------------------------

interface FormErrors {
  email?: string;
  password?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return errors;
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setErrors((prev) => ({ ...prev, email: undefined }));
    setServerError(null);
  }, []);

  const handlePasswordChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setErrors((prev) => ({ ...prev, password: undefined }));
    setServerError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const fieldErrors = validate(email, password);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      setServerError(null);

      try {
        await login(email, password);
        navigate('/dashboard', { replace: true });
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response) {
          const status = err.response.status;
          if (status === 401) {
            setServerError('Invalid email or password');
          } else if (status === 422) {
            setServerError('Please check your input and try again');
          } else {
            setServerError('An unexpected error occurred. Please try again.');
          }
        } else {
          setServerError('Unable to connect to the server. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, login, navigate],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-600 text-white">
            <Shield size={24} aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              EQIP
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Enterprise Quality Intelligence Platform
            </p>
          </div>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {/* Server error */}
            {serverError && (
              <Alert
                variant="error"
                onDismiss={() => setServerError(null)}
              >
                {serverError}
              </Alert>
            )}

            {/* Email */}
            <FormField
              label="Email"
              name="email"
              required
              error={errors.email}
            >
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={handleEmailChange}
                disabled={loading}
                aria-required="true"
                aria-invalid={!!errors.email || undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                placeholder="you@company.com"
              />
            </FormField>

            {/* Password */}
            <FormField
              label="Password"
              name="password"
              required
              error={errors.password}
            >
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={handlePasswordChange}
                disabled={loading}
                aria-required="true"
                aria-invalid={!!errors.password || undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                placeholder="••••••••"
              />
            </FormField>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full"
            >
              Sign in
            </Button>

            {/* Demo credentials hint */}
            <p className="text-center text-xs text-foreground-muted">
              Demo: <span className="font-medium text-foreground">admin@eqip.dev</span>{' '}
              / <span className="font-medium text-foreground">Admin123!</span>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;

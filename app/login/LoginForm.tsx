'use client';

import { ShieldCheck } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { FormPagePreloader } from '@/components/smoothui/page-preloader';
import AnimatedInput from '@/components/smoothui/animated-input';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { Link003 } from '@/components/ui/skiper-ui/skiper40';
import { login } from './actions';

const errors: Record<string, string> = {
  invalid: 'Email atau password tidak sesuai.',
  server: 'Portal sedang tidak dapat terhubung. Silakan coba lagi.',
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <InteractiveHoverButton className="auth-submit" disabled={pending} type="submit">
      {pending ? 'Signing in...' : 'Sign in securely'}
    </InteractiveHoverButton>
  );
}

export default function LoginForm({ error }: { error?: string }) {
  return (
    <form action={login} className="auth-form">
      <FormPagePreloader />
      {error && <div className="auth-error" role="alert">{errors[error] || errors.invalid}</div>}
      <div className="auth-field">
        <AnimatedInput autoComplete="username" label="Email address" name="email" required type="email" />
      </div>
      <div className="auth-field">
        <AnimatedInput autoComplete="current-password" label="Password" minLength={8} name="password" required type="password" />
      </div>
      <SubmitButton />
      <p className="auth-security"><ShieldCheck aria-hidden size={16} /> Secure role-based access for KRYAcademia teams.</p>
      <Link003 className="auth-back" href="/">Back to KRYAcademia</Link003>
    </form>
  );
}

'use client';
import { useActionState } from 'react';
import AnimatedInput from '@/components/smoothui/animated-input';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { FormPagePreloader, PageLoadingLink as Link } from '@/components/smoothui/page-preloader';
import { registerTeacher } from './actions';

export default function RegisterForm() {
  const [state, action, pending] = useActionState(registerTeacher, { error: '' });
  return state.received ? <div className="auth-form"><p role="status">Application received. Eligible applications will be reviewed by admin before access is granted.</p><Link className="auth-back" href="/login">Return to sign in</Link></div> : <form action={action} className="auth-form">
    <FormPagePreloader />
    {state.error && <p className="auth-error" role="alert">{state.error}</p>}
    <div className="auth-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <fieldset disabled={pending} className="auth-register-fields">
      <div className="auth-field"><AnimatedInput label="Full name" name="name" autoComplete="name" maxLength={120} required /></div>
      <div className="auth-field"><AnimatedInput label="Email address" name="email" autoComplete="email" type="email" maxLength={254} required /></div>
      <div className="auth-field"><AnimatedInput label="Password (15+ characters)" name="password" type="password" autoComplete="new-password" minLength={15} maxLength={72} required /></div>
      <div className="auth-field"><AnimatedInput label="Confirm password" name="confirmation" type="password" autoComplete="new-password" minLength={15} maxLength={72} required /></div>
      <InteractiveHoverButton className="auth-submit" type="submit">{pending ? 'Submitting...' : 'Submit application'}</InteractiveHoverButton>
    </fieldset>
    <Link className="auth-back" href="/login">Already have an account? Sign in</Link>
  </form>;
}

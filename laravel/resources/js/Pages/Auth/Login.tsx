import { useState, type FormEvent } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import AnimatedInput from '../../components/smoothui/animated-input';
import { InteractiveHoverButton } from '../../components/ui/interactive-hover-button';
import { Link003 } from '../../components/ui/skiper-ui/skiper40';

export default function Login() {
  const { errors, flash } = usePage<any>().props;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    router.post('/login', { email, password }, {
      onFinish: () => setPending(false),
    });
  };

  const errorMessage = errors?.email || errors?.password || flash?.error;

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="auth-brand" href="/" aria-label="KRYAcademia home">
          <img src="/kryacademia-logo.png" width={48} height={52} alt="" />
          <strong>KRYAcademia</strong>
        </Link>
        <span>Teacher &amp; Admin Portal</span>
      </header>

      <section className="auth-visual">
        <img
          src="/activities/collaboration.jpg"
          alt="KRYAcademia coach guiding students in a classroom activity"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div className="auth-visual-copy">
          <span>Inspiring · Creating · Dedicating</span>
          <h1>The space behind every learning experience.</h1>
          <p>One secure portal for the people who make purposeful learning happen.</p>
        </div>
        <b className="auth-edition" aria-hidden="true">21</b>
      </section>

      <section className="auth-content">
        <div className="auth-panel">
          <span className="auth-eyebrow">Welcome to the portal</span>
          <h2>Welcome <em>back.</em></h2>
          <p>Sign in with your assigned KRYAcademia account.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            {flash?.success && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-sm mb-4" role="alert">
                {flash.success}
              </div>
            )}
            {errorMessage && (
              <div className="auth-error" role="alert">
                {errorMessage}
              </div>
            )}
            <div className="auth-field">
              <AnimatedInput
                autoComplete="username"
                label="Email address"
                name="email"
                required
                type="email"
                value={email}
                onChange={setEmail}
              />
            </div>
            <div className="auth-field">
              <AnimatedInput
                autoComplete="current-password"
                label="Password"
                minLength={8}
                name="password"
                required
                type="password"
                value={password}
                onChange={setPassword}
              />
            </div>
            <InteractiveHoverButton className="auth-submit" disabled={pending} type="submit">
              {pending ? 'Signing in...' : 'Sign in securely'}
            </InteractiveHoverButton>
            <p className="auth-security">
              <ShieldCheck aria-hidden size={16} /> Secure role-based access for KRYAcademia teams.
            </p>
            <Link003 className="auth-back" href="/register">Apply with teacher invitation</Link003>
            <Link003 className="auth-back" href="/">Back to KRYAcademia</Link003>
          </form>
        </div>
      </section>

      <footer className="auth-footer">
        <span>THE 21ST EDUCATION CENTER</span>
        <span>Secure access · KRYAcademia</span>
      </footer>
    </main>
  );
}

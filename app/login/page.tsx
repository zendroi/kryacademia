import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { login } from './actions';

const errors: Record<string, string> = {
  invalid: 'Email atau password tidak sesuai.',
  server: 'Portal sedang tidak dapat terhubung. Silakan coba lagi.',
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session) redirect(`/${session.role}`);
  const { error } = await searchParams;

  return <main className="auth-page">
    <Link className="auth-brand" href="/" aria-label="KRYAcademia home"><Image src="/kryacademia-logo.png" width={52} height={56} alt="" priority /><strong>KRYAcademia</strong></Link>
    <div className="auth-art" aria-hidden="true"><b>21</b></div>
    <section className="auth-panel">
      <span>Teacher &amp; Admin Portal</span>
      <h1>Welcome<br /><em>Back.</em></h1>
      <p>Sign in with your assigned KRYAcademia account.</p>
      {error && <div className="auth-error" role="alert">{errors[error] || errors.invalid}</div>}
      <form action={login}>
        <label>Email<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={8} /></label>
        <button type="submit">Sign In <span aria-hidden="true">↗</span></button>
      </form>
      <Link className="auth-back" href="/">← Back to KRYAcademia</Link>
    </section>
    <footer>THE 21ST EDUCATION CENTER</footer>
  </main>;
}

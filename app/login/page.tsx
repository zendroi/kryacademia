import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session) redirect(`/${session.role}`);
  const { error } = await searchParams;

  return <main className="auth-page">
    <header className="auth-header">
      <Link className="auth-brand" href="/" aria-label="KRYAcademia home"><Image src="/kryacademia-logo.png" width={48} height={52} alt="" priority /><strong>KRYAcademia</strong></Link>
      <span>Teacher &amp; Admin Portal</span>
    </header>
    <section className="auth-visual">
      <Image src="/activities/collaboration.jpg" alt="KRYAcademia coach guiding students in a classroom activity" fill priority sizes="(max-width: 760px) 100vw, 52vw" />
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
        <LoginForm error={error} />
      </div>
    </section>
    <footer className="auth-footer"><span>THE 21ST EDUCATION CENTER</span><span>Secure access · KRYAcademia</span></footer>
  </main>;
}

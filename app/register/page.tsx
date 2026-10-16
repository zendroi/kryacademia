import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageLoadingLink as Link } from '@/components/smoothui/page-preloader';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(`/${session.role}`);
  return <main className="auth-page">
    <header className="auth-header"><Link className="auth-brand" href="/" aria-label="KRYAcademia home"><Image src="/kryacademia-logo.png" width={48} height={52} alt="" priority /><strong>KRYAcademia</strong></Link><span>Teacher application</span></header>
    <section className="auth-visual"><Image src="/activities/collaboration.jpg" alt="KRYAcademia coach guiding students" fill priority sizes="(max-width: 760px) 100vw, 52vw" /><div className="auth-visual-copy"><span>Inspiring. Creating. Dedicating.</span><h1>Make learning meaningful.</h1></div></section>
    <section className="auth-content"><div className="auth-panel"><span className="auth-eyebrow">Teacher application</span><h2>Join our <em>coaches.</em></h2><RegisterForm /></div></section>
  </main>;
}

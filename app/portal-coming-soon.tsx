import Image from 'next/image';
import { Clock3, ShieldCheck } from 'lucide-react';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { Link003 } from '@/components/ui/skiper-ui/skiper40';
import { FormPagePreloader, PageLoadingLink as Link } from '@/components/smoothui/page-preloader';
import { logout } from './login/actions';
import type { Role } from '@/lib/auth';

export default function PortalComingSoon({ email, role }: { email: string; role: Role }) {
  const label = role === 'admin' ? 'Admin' : 'Teacher';
  return <main className="auth-page portal-page">
    <header className="auth-header">
      <Link className="auth-brand" href="/" aria-label="KRYAcademia home"><Image src="/kryacademia-logo.png" width={48} height={52} alt="" priority /><strong>KRYAcademia</strong></Link>
      <span>{label} Portal</span>
    </header>
    <section className="auth-visual portal-visual">
      <Image src="/activities/learning-26.jpg" alt="Students collaborating during a KRYAcademia learning activity" fill priority sizes="(max-width: 760px) 100vw, 52vw" />
      <div className="auth-visual-copy">
        <span>Your KRYAcademia workspace</span>
        <h1>Built for learning that moves forward.</h1>
        <p>Tools, information, and collaboration will come together here.</p>
      </div>
      <b className="auth-edition" aria-hidden="true">21</b>
    </section>
    <section className="auth-content">
      <div className="auth-panel portal-panel">
        <span className="auth-eyebrow">{label} workspace</span>
        <h2>Coming <em>soon.</em></h2>
        <p>We are preparing a focused workspace for KRYAcademia {label.toLowerCase()} accounts.</p>
        <div className="portal-status"><Clock3 aria-hidden size={20} /><div><strong>Workspace in progress</strong><span>Your account is active and ready for the next release.</span></div></div>
        <div className="portal-account"><ShieldCheck aria-hidden size={18} /><div><small>Signed in as</small><strong>{email}</strong></div></div>
        <div className="portal-actions">
          <Link003 className="portal-home" href="/">Back to website</Link003>
          <form action={logout}><FormPagePreloader /><InteractiveHoverButton className="portal-logout" type="submit">Log out</InteractiveHoverButton></form>
        </div>
      </div>
    </section>
    <footer className="auth-footer"><span>THE 21ST EDUCATION CENTER</span><span>Secure access · KRYAcademia</span></footer>
  </main>;
}

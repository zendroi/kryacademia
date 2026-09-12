import Link from 'next/link';
import Image from 'next/image';

export default function Login() {
  return <main className="soon">
    <Link className="brand" href="/" aria-label="KRYAcademia home"><Image src="/kryacademia-logo.png" width={48} height={48} alt="" /><strong>KRYAcademia</strong></Link>
    <div className="art"><b>21</b></div>
    <section><span>Teacher &amp; Admin Portal</span><h1>Coming<br /><em>Soon.</em></h1><p>We are preparing a dedicated space for KRYAcademia teachers and administrators.</p><Link href="/">Back to KRYAcademia</Link></section>
    <footer>THE 21ST EDUCATION CENTER</footer>
  </main>;
}

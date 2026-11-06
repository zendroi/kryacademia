import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { ImagePlus, ShieldCheck } from 'lucide-react';
import AnimatedInput from '../../components/smoothui/animated-input';
import { InteractiveHoverButton } from '../../components/ui/interactive-hover-button';
import { Link003 } from '../../components/ui/skiper-ui/skiper40';
import { compressImage, type CompressedImage } from '../../lib/client-image';

export default function Register({ invitation = '' }: { invitation?: string }) {
  const { errors, flash } = usePage<any>().props;
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [photo, setPhoto] = useState<CompressedImage | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState(invitation);

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhoto(null);
    setUploadError('');
    if (!file) return;
    setProcessing(true);
    try { setPhoto(await compressImage(file)); }
    catch (error) { setUploadError(error instanceof Error ? error.message : 'Choose a valid JPEG, PNG, or WebP image.'); }
    finally { setProcessing(false); }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!token || pending || processing) return;
    if (!photo) {
      setUploadError('Silakan pilih foto KTP.');
      return;
    }

    setPending(true);

    const formData = new FormData();
    formData.append('invitation', token);
    formData.append('name', name);
    formData.append('bank', bank);
    formData.append('account', account);
    formData.append('holder', holder);
    const bytes = Uint8Array.from(atob(photo.data.split(',')[1]), (char) => char.charCodeAt(0));
    formData.append('identity', new File([bytes], 'identity.webp', { type: 'image/webp' }));

    router.post('/register', formData, {
      onFinish: () => setPending(false),
    });
  };

  const errorMessage = uploadError || errors?.invitation || errors?.name || errors?.identity || errors?.bank || errors?.account || errors?.holder || flash?.error;

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="auth-brand" href="/" aria-label="KRYAcademia home">
          <img src="/kryacademia-logo.png" width={48} height={52} alt="" />
          <strong>KRYAcademia</strong>
        </Link>
        <span>Teacher Onboarding</span>
      </header>

      <section className="auth-visual">
        <img
          src="/activities/collaboration.jpg"
          alt="KRYAcademia coach guiding students in a classroom activity"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div className="auth-visual-copy">
          <span>Inspiring · Creating · Dedicating</span>
          <h1>Join our community of passionate educators.</h1>
          <p>Complete your profile and identity verification to activate your teacher account.</p>
        </div>
      </section>

      <section className="auth-content">
        <div className="auth-panel">
          <span className="auth-eyebrow">Teacher Onboarding</span>
          <h2>Register <em>profile.</em></h2>
          <p>Lengkapi data verifikasi akun pengajar KRYAcademia Anda.</p>

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

            {!invitation && (
              <div className="auth-field">
                <AnimatedInput
                  label="Invitation Token"
                  name="invitation"
                  required
                  value={token}
                  onChange={setToken}
                  placeholder="Paste 64-character token"
                />
              </div>
            )}

            <div className="auth-field">
              <AnimatedInput
                label="Full name"
                name="name"
                autoComplete="name"
                maxLength={120}
                required
                value={name}
                onChange={setName}
              />
            </div>
            <div className="auth-field">
              <AnimatedInput
                label="Bank name (e.g. BCA, Mandiri)"
                name="bank"
                maxLength={100}
                required
                value={bank}
                onChange={setBank}
              />
            </div>
            <div className="auth-field">
              <AnimatedInput
                label="Bank account number"
                name="account"
                maxLength={40}
                required
                value={account}
                onChange={setAccount}
              />
            </div>
            <div className="auth-field">
              <AnimatedInput
                label="Account holder name"
                name="holder"
                autoComplete="name"
                maxLength={120}
                required
                value={holder}
                onChange={setHolder}
              />
            </div>

            <label className="auth-identity-upload">
              <span>KTP photo *</span>
              <span className="auth-photo-button">
                <ImagePlus size={18} />
                {photo ? 'Replace photo' : 'Choose photo'}
                <input
                  className="sr-only"
                  aria-label="KTP photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={handlePhotoChange}
                />
              </span>
            </label>

            {photo && (
              <div className="my-2 border rounded-lg p-2 bg-white">
                <img
                  src={photo.data}
                  alt="KTP preview"
                  className="h-36 object-contain mx-auto"
                />
              </div>
            )}

            <InteractiveHoverButton className="auth-submit" type="submit" disabled={pending || processing || !token || !photo}>
              {processing ? 'Processing photo...' : pending ? 'Submitting...' : 'Submit Profile Application'}
            </InteractiveHoverButton>

            <Link003 className="auth-back" href="/login">Already registered? Sign in</Link003>
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

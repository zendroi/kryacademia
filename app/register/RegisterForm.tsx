'use client';
import { useActionState, useState } from 'react';
import Image from 'next/image';
import { ImagePlus } from 'lucide-react';
import { compressImage, type CompressedImage } from '@/lib/client-image';
import AnimatedInput from '@/components/smoothui/animated-input';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { FormPagePreloader, PageLoadingLink as Link } from '@/components/smoothui/page-preloader';
import { registerTeacher } from './actions';

export default function RegisterForm({ invitation }: { invitation: string }) {
  const [photo, setPhoto] = useState<CompressedImage | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [state, action, pending] = useActionState(async (previous: { error?: string; received?: boolean }, form: FormData) => {
    if (!photo) return { error: 'Choose a KTP photo.' };
    const bytes = Uint8Array.from(atob(photo.data.split(',')[1]), (char) => char.charCodeAt(0));
    form.set('identity', new File([bytes], 'identity.webp', { type: 'image/webp' }));
    return registerTeacher(previous, form);
  }, { error: '' });
  if (!invitation) return <div className="auth-form"><p>Request your teacher account and registration invitation from admin.</p><Link className="auth-back" href="/login">Return to sign in</Link></div>;
  return state.received ? <div className="auth-form"><p role="status">Application received. Eligible applications will be reviewed by admin before access is granted.</p><Link className="auth-back" href="/login">Return to sign in</Link></div> : <form action={action} className="auth-form">
    <FormPagePreloader />
    <input type="hidden" name="invitation" value={invitation} />
    {state.error && <p className="auth-error" role="alert">{state.error}</p>}
    <div className="auth-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <fieldset disabled={pending || processing} className="auth-register-fields">
      <div className="auth-field"><AnimatedInput label="Full name" name="name" autoComplete="name" maxLength={120} required /></div>
      <div className="auth-field"><AnimatedInput label="Bank name" name="bank" maxLength={100} required /></div>
      <div className="auth-field"><AnimatedInput label="Bank account number" name="account" maxLength={40} required /></div>
      <div className="auth-field"><AnimatedInput label="Account holder name" name="holder" autoComplete="name" maxLength={120} required /></div>
      <label className="auth-identity-upload"><span>KTP photo</span><span className="auth-photo-button"><ImagePlus size={18} />{photo ? 'Replace photo' : 'Choose photo'}<input className="sr-only" aria-label="KTP photo" type="file" accept="image/jpeg,image/png,image/webp" required onChange={async (event) => {
        const file = event.target.files?.[0]; setPhoto(null); setUploadError('');
        if (!file) return;
        setProcessing(true);
        try { setPhoto(await compressImage(file)); } catch { setUploadError('Choose a valid JPEG, PNG, or WebP image, up to 10 MB.'); } finally { setProcessing(false); }
      }} /></span></label>
      {photo && <Image src={photo.data} alt="Your KTP photo preview" width={240} height={150} unoptimized style={{ objectFit: 'contain', maxWidth: '100%' }} />}
      {uploadError && <p className="auth-error" role="alert">{uploadError}</p>}
      <InteractiveHoverButton className="auth-submit" type="submit" disabled={!photo || processing}>{processing ? 'Processing photo...' : pending ? 'Submitting...' : 'Submit application'}</InteractiveHoverButton>
    </fieldset>
    <Link className="auth-back" href="/login">Already have an account? Sign in</Link>
  </form>;
}

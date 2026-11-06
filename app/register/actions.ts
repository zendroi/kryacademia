'use server';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { portalClientAddress, portalLimit } from '@/lib/portal-limits';
import { verifyUpload } from '@/lib/upload-validation.mjs';
import { stagePrivateFile } from '@/lib/private-files.mjs';
import { clause } from '@/lib/sql-dialect.mjs';

export async function registerTeacher(_previous: { error?: string; received?: boolean }, form: FormData) {
  if (!(form instanceof FormData)) return { error: 'Invalid application.' };
  const name = String(form.get('name') || '').trim();
  const token = String(form.get('invitation') || '');
  const bank = String(form.get('bank') || '').trim();
  const account = String(form.get('account') || '').trim();
  const holder = String(form.get('holder') || '').trim();
  const photo = form.get('identity');
  if (form.get('website') || !/^[a-f0-9]{64}$/.test(token) || !name || name.length > 120 || !bank || bank.length > 100 || !/^\d{4,40}$/.test(account.replace(/[ -]/g, '')) || !holder || holder.length > 120 || !(photo instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size < 1 || photo.size > 184320) return { error: 'Check your invitation, name, bank details, and KTP photo.' };
  try {
    const clientIp = await portalClientAddress();
    if (clientIp && !(await portalLimit('register:ip', clientIp, 5, 3600))) return { error: 'Too many applications. Please try again after one hour.' };
    const hash = createHash('sha256').update(token).digest('hex');
    const sql = db();
    const [available] = await sql`SELECT o.email FROM teacher_onboarding o JOIN portal_users u ON u.email = o.email WHERE o.invitation_hash = ${hash} AND o.expires_at > CURRENT_TIMESTAMP(6) AND o.completed_at IS NULL AND u.role = 'teacher' AND u.status = 'pending'`;
    if (!available) return { error: 'This invitation is unavailable or expired. Contact admin.' };
    const bytes = Buffer.from(await photo.arrayBuffer());
    const verified = await verifyUpload({ name: 'identity.webp', mime: photo.type, size: bytes.length, data: `data:${photo.type};base64,${bytes.toString('base64')}` });
    await sql.begin(async (tx) => {
      const [row] = await tx`SELECT o.email FROM teacher_onboarding o JOIN portal_users u ON u.email = o.email WHERE o.invitation_hash = ${hash} AND o.expires_at > CURRENT_TIMESTAMP(6) AND o.completed_at IS NULL AND u.role = 'teacher' AND u.status = 'pending' ${clause(tx, 'FOR UPDATE OF o, u', 'FOR UPDATE')}`;
      if (!row) throw new Error('Invitation no longer available.');
      const objectId = await stagePrivateFile(tx, verified);
      await tx`UPDATE teacher_onboarding SET bank_name = ${bank}, bank_account = ${account.replace(/[ -]/g, '')}, account_holder = ${holder}, identity_object_id = ${objectId}, completed_at = CURRENT_TIMESTAMP(6) WHERE email = ${row.email}`;
      await tx`UPDATE portal_users SET display_name = ${name}, revision = revision + 1 WHERE email = ${row.email}`;
    });
    return { received: true };
  } catch { return { error: 'Could not submit your profile. Check the invitation or retry.' }; }
}

'use server';
import { db } from '@/lib/db';
import { portalClientAddress, portalLimit } from '@/lib/portal-limits';

export async function registerTeacher(_previous: { error?: string; received?: boolean }, form: FormData) {
  if (!(form instanceof FormData)) return { error: 'Invalid application.' };
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  if (form.get('website') || !name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 15 || Buffer.byteLength(password) > 72 || password !== form.get('confirmation')) return { error: 'Check your name, email, and matching passwords (15 characters minimum, 72 bytes maximum).' };
  try {
    if (!(await portalLimit('register:ip', await portalClientAddress(), 5, 3600)) || !(await portalLimit('register:account', email, 3, 3600))) return { error: 'Too many applications. Please try again after one hour.' };
    await db()`INSERT INTO portal_users (email, password_hash, role, display_name, status)
      VALUES (${email}, crypt(${password}, gen_salt('bf', 12)), 'teacher', ${name}, 'pending') ON CONFLICT (email) DO NOTHING`;
    return { received: true };
  } catch { return { error: 'Could not submit your application. Please retry.' }; }
}

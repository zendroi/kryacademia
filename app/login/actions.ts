'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, revokeCurrentSession, SESSION_COOKIE, type Role } from '@/lib/auth';
import { db } from '@/lib/db';
import { portalClientAddress, portalLimit } from '@/lib/portal-limits';
import { verifyPassword } from '@/lib/passwords.mjs';

type PortalUser = { email: string; role: Role; status: string };

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || email.length > 254 || password.length < 8 || Buffer.byteLength(password) > 72) redirect('/login?error=invalid');

  let user: PortalUser | undefined;
  let error = '';
  let token = '';
  try {
    const clientIp = await portalClientAddress();
    const ipAllowed = clientIp ? await portalLimit('login:ip', clientIp, 60, 900) : true;
    const accountAllowed = await portalLimit('login:account', email, 10, 900);
    if (!ipAllowed || !accountAllowed) error = 'limited';
    else {
      const [candidate] = await db()<(PortalUser & { password_hash: string })[]>`
        SELECT email, role, status, password_hash FROM portal_users WHERE email = ${email}
      `;
      const verified = await verifyPassword(password, candidate?.password_hash);
      if (candidate && verified) user = { email: candidate.email, role: candidate.role, status: candidate.status };
    }
    if (user?.status === 'active') token = await createSessionToken(user.email, user.role);
  } catch {
    console.error('Portal login unavailable');
    error = 'server';
  }
  if (error) redirect(`/login?error=${error}`);
  if (!user) redirect('/login?error=invalid');
  if (user.status !== 'active') redirect(`/login?error=${user.status === 'pending' ? 'pending' : 'invalid'}`);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60,
    path: '/',
  });
  redirect(`/${user.role}`);
}

export async function logout() {
  await revokeCurrentSession();
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

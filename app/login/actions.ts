'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, revokeCurrentSession, SESSION_COOKIE, type Role } from '@/lib/auth';
import { db } from '@/lib/db';
import { portalClientAddress, portalLimit } from '@/lib/portal-limits';

type PortalUser = { email: string; role: Role; status: string };

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || email.length > 254 || password.length < 8 || Buffer.byteLength(password) > 72) redirect('/login?error=invalid');

  let user: PortalUser | undefined;
  let error = '';
  let token = '';
  try {
    if (!(await portalLimit('login:ip', await portalClientAddress(), 60, 900)) || !(await portalLimit('login:account', email, 10, 900))) error = 'limited';
    else {
      // Keep password-hash work for unknown emails too.
      const dummyHash = '$2a$12$gjccHS/IAdCt0Nw3tneE0.Q/eFJJAF1POtzGFHGURFnuN1b7JgZPW';
      const [candidate] = await db()<(PortalUser & { verified: boolean })[]>`
        SELECT u.email, u.role, u.status,
          crypt(${password}, COALESCE(u.password_hash, ${dummyHash})) = COALESCE(u.password_hash, ${dummyHash}) AS verified
        FROM (SELECT 1) AS seed LEFT JOIN portal_users u ON u.email = ${email}
      `;
      if (candidate?.email && candidate.verified) user = candidate;
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

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, SESSION_COOKIE, type Role } from '@/lib/auth';
import { db } from '@/lib/db';

type PortalUser = { email: string; role: Role };

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || email.length > 254 || password.length < 8 || password.length > 128) redirect('/login?error=invalid');

  let user: PortalUser | undefined;
  try {
    [user] = await db()<PortalUser[]>`
      SELECT email, role
      FROM portal_users
      WHERE email = ${email} AND password_hash = crypt(${password}, password_hash)
      LIMIT 1
    `;
  } catch (error) {
    console.error('Login database error', error);
    redirect('/login?error=server');
  }
  if (!user) redirect('/login?error=invalid');

  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.email, user.role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60,
    path: '/',
  });
  redirect(`/${user.role}`);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

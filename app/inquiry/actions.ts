'use server';
import { textColumn, lockScope, clause } from '@/lib/sql-dialect.mjs';

import { createHash } from 'node:crypto';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadInquiries } from '@/lib/inquiries';
import { validateInquiry, type InquiryRecord, type InquiryStatus } from '@/lib/inquiry';
import { klasses, programs } from '../mockData';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function submitInquiry(form: FormData) {
  if (!(form instanceof FormData) || form.get('website')) return { ok: false as const, error: 'validation' as const, fields: [] };
  const { data, fields } = validateInquiry(form);
  const id = form.get('submission-id');
  if (typeof id !== 'string' || !uuid.test(id)) fields.push('submission-id');
  if (data.details.klass && !klasses.some(([name]) => name === data.details.klass)) fields.push('klass');
  if (data.details.program && data.details.program !== 'Custom Program' && !programs.some(([name]) => name === data.details.program)) fields.push('program');
  if (fields.length) return { ok: false as const, error: 'validation' as const, fields };
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  try {
    const result = await db().begin(async (tx) => {
      // Serialize the per-email quota across serverless instances and concurrent submissions.
      await lockScope(tx, data.email);
      const [existing] = await tx`SELECT submission_hash FROM inquiries WHERE id = ${id as string}`;
      if (existing) return existing.submission_hash === hash ? 'saved' : 'validation';
      // ponytail: email quota + honeypot for the pilot; add CAPTCHA/firewall if spam bypasses them.
      const [{ count }] = await tx`SELECT count(*) AS count FROM inquiries WHERE email = ${data.email} AND created_at > CURRENT_TIMESTAMP(6) - ${clause(tx, "INTERVAL '15 minutes'", 'INTERVAL 15 MINUTE')}`;
      if (count >= 5) return 'rateLimit';
      await tx`
        INSERT INTO inquiries (id, submission_hash, name, email, phone, place, type, affiliation, institution, message, language, details)
        VALUES (${id as string}, ${hash}, ${data.name}, ${data.email}, ${data.phone}, ${data.place}, ${data.type}, ${data.affiliation}, ${data.institution}, ${data.message}, ${data.language}, ${tx.json(data.details)})
      `;
      return 'saved';
    });
    if (result === 'saved') return { ok: true as const };
    return { ok: false as const, error: result as 'validation' | 'rateLimit', fields: [] };
  } catch (error) {
    console.error('Inquiry submission failed', (error as { code?: string }).code || 'Database unavailable');
    return { ok: false as const, error: 'unavailable' as const, fields: [] };
  }
}

export async function refreshInquiries() {
  await requireRole('admin');
  try { return { ok: true as const, records: await loadInquiries() }; }
  catch { return { ok: false as const, error: 'Could not load inquiries. Please retry.' }; }
}

export async function updateInquiryStatus(id: string, status: InquiryStatus) {
  await requireRole('admin');
  if (typeof id !== 'string' || !uuid.test(id) || !['Contacted', 'Resolved'].includes(status)) return { ok: false as const, error: 'Invalid inquiry status.' };
  try {
    const record = await db().begin(async (tx) => {
      const [before] = await tx`SELECT id FROM inquiries WHERE id = ${id} AND status != 'Resolved' AND (${status} = 'Resolved' OR status = 'New') FOR UPDATE`;
      if (!before) return undefined;
      await tx`UPDATE inquiries SET status = ${status}, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ${id}`;
      const [saved] = await tx<InquiryRecord[]>`SELECT id, name, email, phone, place, type, affiliation, institution, message, language, details, status, ${textColumn(tx, 'created_at')} AS date, ${textColumn(tx, 'updated_at')} AS "updatedAt" FROM inquiries WHERE id = ${id}`;
      return saved;
    });
    return record ? { ok: true as const, record } : { ok: false as const, error: 'This inquiry changed or is unavailable. Refresh the inbox.' };
  } catch { return { ok: false as const, error: 'Could not save the status. Please retry.' }; }
}

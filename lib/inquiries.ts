import 'server-only';
import { textColumn } from './sql-dialect.mjs';
import { requireRole } from './auth';
import { db } from './db';
import type { InquiryRecord } from './inquiry';

export async function loadInquiries(): Promise<InquiryRecord[]> {
  await requireRole('admin');
  // ponytail: load the complete pilot inbox; paginate server-side when the inbox grows.
  return db()<InquiryRecord[]>`
    SELECT id, name, email, phone, place, type, affiliation, institution,
      message, language, details, status, ${textColumn(db(), 'created_at')} AS date, ${textColumn(db(), 'updated_at')} AS "updatedAt"
    FROM inquiries ORDER BY created_at DESC, id DESC
  `;
}

import 'server-only';
import type postgres from 'postgres';
import { db } from './db';
import { assignedCatalog, type AcademyCatalog } from './academy';
import { readAcademicCore } from './academic-core';
import { requireRole } from './auth';

type Transaction = postgres.TransactionSql;

export async function readAcademyCatalog(tx: Transaction): Promise<AcademyCatalog> {
  const [state] = await tx`SELECT relational_ready FROM academy_core_state WHERE id = 1 FOR SHARE`;
  if (!state?.relational_ready) throw new Error('Run the Phase 3 database migration before using the portal.');
  return readAcademicCore(tx);
}

async function readCatalog(): Promise<AcademyCatalog> {
  const sql = db();
  return sql.begin(readAcademyCatalog);
}

export async function loadAcademyCatalog() {
  await requireRole('admin');
  return readCatalog();
}

export async function loadTeachingCatalog(email: string) {
  const session = await requireRole('teacher');
  if (session.email !== email) throw new Error('This account is not accessible.');
  return assignedCatalog(await readCatalog(), session.email);
}

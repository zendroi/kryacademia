import 'server-only';
import { db } from './db';
import { seedCatalog, catalogCounts, assignedCatalog, type AcademyCatalog } from './academy';

export async function loadAcademyCatalog(): Promise<AcademyCatalog> {
  const sql = db();
  await sql`INSERT INTO academy_catalog (id, content) VALUES (1, ${sql.json(seedCatalog())}) ON CONFLICT (id) DO NOTHING`;
  const [row] = await sql`SELECT content FROM academy_catalog WHERE id = 1`;
  return catalogCounts(row.content as AcademyCatalog);
}

export async function loadTeachingCatalog(email: string) {
  return assignedCatalog(await loadAcademyCatalog(), email);
}

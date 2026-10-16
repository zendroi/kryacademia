import { academy, core, workflow } from '../scripts/academic-modules.mjs';
export { academy, core, workflow };

export async function updateCatalog(tx, update) {
  if (!process.env.PORTAL_TEST_SCHEMA?.startsWith('security_check_')) throw new Error('Catalog fixtures require an isolated schema');
  const [scope] = await tx`SELECT current_schema() AS name`;
  if (scope.name !== process.env.PORTAL_TEST_SCHEMA) throw new Error('Fixture connection is outside the isolated schema');
  await tx`SELECT id FROM academy_core_state WHERE id = 1 FOR UPDATE`;
  const catalog = await core.readAcademicCore(tx);
  await update(catalog);
  await core.writeAcademicCore(tx, academy.catalogCounts(catalog));
  return catalog;
}

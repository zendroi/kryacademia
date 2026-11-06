import { workspace } from '@/lib/workspace';
export const saveAcademyRecord = (kind: string, id: string | null, revision: number, input: Record<string, unknown>) => workspace('catalog', { kind, id, revision, input });

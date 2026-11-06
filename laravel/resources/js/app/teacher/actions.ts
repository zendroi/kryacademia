import { workspace } from '@/lib/workspace';
import type { RecordDraft, RecordStatus, RequestLine } from './teacherData';
export const saveTeachingRecord = (input: RecordDraft) => workspace('records', input);
export const reviewTeachingRecord = (id: string, status: RecordStatus, note: string, revision: number, remarks?: Pick<RequestLine, 'id' | 'adminNote'>[]) => workspace('records/review', { id, status, note, revision, remarks });
export const markTeacherNotificationsRead = () => workspace('notifications/read', {});
export const refreshTeacherWorkspace = () => workspace('teacher');

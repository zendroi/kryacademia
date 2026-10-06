import { klasses, students } from '../admin/adminData';

// Sample assignments share the admin catalog until official teacher rosters are provided.
export const teachingClasses = klasses.filter((item) => ['biotech-10', 'steamaker-cikal', 'coding'].includes(item.id));
export const canvaTemplates = ['https://canva.link/tf9z5tip7qyaou8', 'https://canva.link/8fjc4y6njxplyrs', 'https://canva.link/tc5cebwq56d8044', 'https://canva.link/vwxt65610c4ckqw'];
export function roster(classId: string) {
  return students.filter((student) => student.klass === teachingClasses.find((item) => item.id === classId)?.title);
}

export const recordLabels = { meeting: 'Meeting journal', 'lesson-plan': 'Lesson plan', syllabus: 'Syllabus', slides: 'Material slides', request: 'Class request' };
export type RecordKind = keyof typeof recordLabels;
export type RecordStatus = 'Draft' | 'Submitted' | 'Approved' | 'Needs revision' | 'Rejected' | 'Fulfilled';
export type Attendance = 'Present' | 'Late' | 'Excused' | 'Absent';
export const attendanceOptions: Attendance[] = ['Present', 'Late', 'Excused', 'Absent'];
export type StudentEntry = { id: string; attendance: Attendance; score: string; feedback: string };
export type TeachingContent = {
  teacherAttendance?: Attendance;
  students?: StudentEntry[];
  reflection?: string;
  objectives?: string;
  activities?: string;
  resources?: string;
  outline?: string;
  canvaUrl?: string;
  items?: string;
  reason?: string;
  timing?: 'Before class' | 'Before semester';
};
export type TeachingFile = { id: string; name: string; mime: string; size: number; data?: string };
export type RecordDraft = { id?: string; kind: RecordKind; classId: string; date: string; title: string; content: TeachingContent; files: TeachingFile[]; submit: boolean };
export type TeachingRecord = Omit<RecordDraft, 'submit'> & { id: string; teacherEmail: string; status: RecordStatus; reviewerNote: string; updatedAt: string };
export type TeacherNotification = { id: string; recordId: string; title: string; message: string; read: boolean; createdAt: string };
export type TeachingConfig = { semesterStart: string; deadline: string; sample: boolean; canvaTemplate: string };

export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${date.slice(0, 10)}T12:00:00+07:00`));
}

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function validateDraft(input: RecordDraft, config: TeachingConfig) {
  if (!input || !Object.hasOwn(recordLabels, input.kind) || !teachingClasses.some((item) => item.id === input.classId)) throw new Error('Choose a valid Klass.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || new Date(`${input.date}T12:00:00Z`).toISOString().slice(0, 10) !== input.date) throw new Error('Choose a valid date.');
  if (input.id && !/^[a-f0-9-]{36}$/i.test(input.id)) throw new Error('Invalid record.');
  if (typeof input.submit !== 'boolean' || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 140) throw new Error('Enter a title of up to 140 characters.');
  if (!input.content || typeof input.content !== 'object' || Array.isArray(input.content) || JSON.stringify(input.content).length > 30000) throw new Error('The content is too large.');
  const text = (key: keyof TeachingContent, required = input.submit) => {
    const value = input.content[key];
    if (value !== undefined && (typeof value !== 'string' || value.length > 6000)) throw new Error('Text fields must be under 6,000 characters.');
    if (required && (typeof value !== 'string' || !value.trim())) throw new Error('Complete the required fields before submitting.');
  };
  if (input.kind === 'meeting') {
    if (!attendanceOptions.includes(input.content.teacherAttendance as Attendance)) throw new Error('Select teacher attendance.');
    const entries = input.content.students;
    const expected = roster(input.classId);
    if (!Array.isArray(entries) || entries.length !== expected.length || new Set(entries.map((item) => item.id)).size !== expected.length) throw new Error('Complete the student attendance list.');
    for (const entry of entries) {
      if (!expected.some((item) => item.id === entry.id) || !attendanceOptions.includes(entry.attendance) || typeof entry.score !== 'string' || typeof entry.feedback !== 'string' || entry.feedback.length > 2000) throw new Error('Invalid student feedback.');
      if (entry.score !== '' && (!Number.isFinite(Number(entry.score)) || Number(entry.score) < 0 || Number(entry.score) > 100)) throw new Error('Student scores must be between 0 and 100.');
      if (input.submit && ['Present', 'Late'].includes(entry.attendance) && (!entry.score.trim() || !entry.feedback.trim())) throw new Error('Add a score and feedback for each attending student.');
    }
    text('reflection');
  }
  if (input.kind === 'lesson-plan') { text('objectives'); text('activities'); text('resources', false); }
  if (input.kind === 'syllabus') { text('objectives'); text('outline'); }
  if (input.kind === 'slides') {
    text('canvaUrl', false);
    if (input.content.canvaUrl) {
      const url = new URL(input.content.canvaUrl);
      if (url.protocol !== 'https:' || !['canva.com', 'www.canva.com', 'canva.link'].includes(url.hostname)) throw new Error('Use a secure Canva design link.');
    }
    if (input.submit && !input.content.canvaUrl && !input.files?.some((file) => file.mime === 'application/pdf')) throw new Error('Add a Canva link or slides PDF.');
  }
  if (input.kind === 'request') {
    text('items'); text('reason');
    if (!['Before class', 'Before semester'].includes(input.content.timing || '')) throw new Error('Select a request timeframe.');
  }
  if (input.kind === 'syllabus' || (input.kind === 'request' && input.content.timing === 'Before semester')) {
    if (input.date !== config.semesterStart) throw new Error('Semester submissions must use the semester start date.');
  }
  if (!Array.isArray(input.files) || input.files.length > 4 || input.files.filter((file) => file.mime.startsWith('image/')).length > 3 || input.files.filter((file) => file.mime === 'application/pdf').length > 1) throw new Error('Attach up to three photos and one PDF.');
  for (const file of input.files) {
    if (!file || !/^[a-f0-9-]{36}$/i.test(file.id) || typeof file.name !== 'string' || !file.name || file.name.length > 140 || !['image/webp', 'image/jpeg', 'image/png', 'application/pdf'].includes(file.mime) || !Number.isInteger(file.size) || file.size < 1 || file.size > (file.mime === 'application/pdf' ? 1048576 : 184320)) throw new Error('A file exceeds the upload limit or has an unsupported format.');
    if (file.data && (typeof file.data !== 'string' || file.data.length > 1400000)) throw new Error('The file is too large.');
  }
}

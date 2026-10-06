import { klasses, students } from '../admin/adminData';
import type { TeachingCatalog } from '@/lib/academy';

// Sample assignments share the admin catalog until official teacher rosters are provided.
export const teachingClasses = klasses.filter((item) => ['biotech-10', 'steamaker-cikal', 'coding'].includes(item.id));
export const canvaTemplates = ['https://canva.link/tf9z5tip7qyaou8', 'https://canva.link/8fjc4y6njxplyrs', 'https://canva.link/tc5cebwq56d8044', 'https://canva.link/vwxt65610c4ckqw'];
export function roster(classId: string, catalog?: TeachingCatalog) {
  return catalog ? catalog.students.filter((student) => student.classIds?.includes(classId)) : students.filter((student) => student.klass === teachingClasses.find((item) => item.id === classId)?.title);
}

export const recordLabels = { meeting: 'Meeting journal', 'lesson-plan': 'Lesson plan', syllabus: 'Syllabus', slides: 'Material recap', request: 'Class request' };
export type RecordKind = keyof typeof recordLabels;
export type RecordStatus = 'Draft' | 'Submitted' | 'Approved' | 'Needs revision' | 'Rejected' | 'Fulfilled';
export type Attendance = 'Present' | 'Late' | 'Excused' | 'Absent';
export const attendanceOptions: Attendance[] = ['Present', 'Late', 'Excused', 'Absent'];
export const learningPhases = ['Inspiring', 'Creating', 'Dedicating'] as const;
export const lessonPhases = [...learningPhases, 'Exploring', 'Applying'] as const;
export const rubricAspects = { affective: 'Afektif', problemSolving: 'Problem solving', storytelling: 'Story telling', performance: 'Kinerja' };
export const rubricLevels = ['Emerging', 'Developing', 'Proficient', 'Advanced'];
export const rubricDescriptions = {
  affective: ['Absent more than twice; often distracted, inactive, or disruptive.', 'Absent at most twice; participates with reminders and occasional distractions.', 'Absent at most twice; punctual, active, and keeps the class conducive.', 'Absent at most twice; consistently punctual, proactive, and a role model for peers.'],
  problemSolving: ['Not yet able to identify problems or solutions.', 'Identifies problems and finds solutions with full guidance.', 'Identifies problems and solutions with a little guidance.', 'Critically analyzes problems and finds effective solutions independently.'],
  storytelling: ['Not yet able to explain ideas or project results clearly.', 'Presents results with full guidance.', 'Presents results clearly and in sequence with a little guidance.', 'Presents confidently, clearly, and independently.'],
  performance: ['Not yet able to follow the learning or practical steps.', 'Follows the steps with intensive guidance.', 'Follows the steps well and occasionally asks for help.', 'Completes the entire process independently and systematically.'],
};
export type Ratings = Record<keyof typeof rubricAspects, string>;
export type SyllabusSession = { date: string; time: string; topic: string; phase: typeof learningPhases[number] };
export type LessonStep = { title: string; phase: typeof lessonPhases[number]; minutes: string; purpose: string; teacherActivity: string; studentActivity: string };
export type StudentEntry = { id: string; name?: string; attendance: Attendance; score: string; feedback: string; ratings?: Ratings };
export type TeachingContent = {
  workflowVersion?: 2;
  syllabusId?: string;
  meetingNumber?: number;
  academicYear?: string;
  semester?: string;
  deadline?: string;
  mainCoach?: string;
  assistantCoach?: string;
  room?: string;
  description?: string;
  values?: string;
  projects?: string;
  projectDescription?: string;
  sessions?: SyllabusSession[];
  steps?: LessonStep[];
  assessment?: string;
  worksheetUrl?: string;
  notes?: string;
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

const sourceDates = ['2026-09-05', '2026-09-12', '2026-09-26', '2026-10-03', '2026-10-17', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21'];
const sourceTopics = {
  'biotech-10': ['Introduction to Biotechnology', 'Microscopic World Exploration', 'Yeast Cellular Respiration', 'Milk Protein Coagulation or Lactic Acid Bacteria Culturing', 'Liquid Culture Fermentation', 'Plant-Based Antimicrobial Action', 'Organic Waste Eco-Enzymes', 'Final project preparation', 'Final project presentation'],
  coding: ['Memahami isu sekitar dan mengeksplorasi ide proyek', 'Eksplorasi ide proyek, algoritma & logika pemrograman', 'Variable & input output', 'Logika percabangan / kondisional', 'Perulangan (looping) & fungsi', 'Pengujian, perbaikan bug & penyempurnaan aplikasi', 'Finalisasi proyek & media presentasi', 'Presentasi & demonstrasi karya', 'Presentasi & demonstrasi karya kedua'],
};

// These are assigned links from the supplied recap PDFs, not replaceable templates.
const presentationLinks = {
  'biotech-10': ['7qu8j7bw0oc4ve1', 'brn95bq75j17sd3', 'xrmhe5f65cf4c7q', 'c4aw4vo3q5vhbji', 'j9wuyiag6vuhppi', 'a5nzrqto2syjm6m', '4212l3jxaygu971', 'yio5jtgkyub460u', 'apqw2kg1fo30gyo'],
  coding: ['vwxt65610c4ckqw', 'tc5cebwq56d8044', '8fjc4y6njxplyrs', 'tf9z5tip7qyaou8', 'i3f5k4c0935yqcq', 'nm765gwx1xzjuaf', 'gumd0qw5kyocojx', 'xylxksxohy6w9ch', 'm7ia4nxnqp1ptgw'],
};
export function assignedMaterials(classId: string, meetingNumber: number) {
  const presentation = presentationLinks[classId as keyof typeof presentationLinks]?.[meetingNumber - 1];
  const worksheet = classId === 'biotech-10' ? ['5gnj7agqoy3l593', 'l1cc3xdxv419wxl'][meetingNumber - 1] : undefined;
  return { canvaUrl: presentation ? `https://canva.link/${presentation}` : '', worksheetUrl: worksheet ? `https://canva.link/${worksheet}` : '' };
}
export function sourceSyllabus(classId: string): TeachingContent | undefined {
  const topics = sourceTopics[classId as keyof typeof sourceTopics];
  if (!topics) return;
  const bio = classId === 'biotech-10';
  return {
    workflowVersion: 2, academicYear: '2026 - 2027', semester: '1', mainCoach: bio ? 'Prisya Mahardita' : 'Raden Refy Ananta Kartanegara', assistantCoach: bio ? 'Rina' : '',
    description: bio ? 'An experiential science program exploring microorganisms, fermentation, food biotechnology, natural antimicrobial action, and sustainability through hands-on investigation.' : 'Mengenalkan dasar pemrograman dan logika untuk menyelesaikan masalah nyata melalui proyek Scratch.',
    objectives: bio ? 'Understand biotechnology in everyday life. Observe, investigate, analyze evidence, and draw scientific conclusions. Apply biotechnology to real-world problems and communicate scientific ideas responsibly.' : 'Mengenal dunia programming dan logika pemrograman untuk mengatasi masalah di dunia nyata.',
    values: bio ? 'Thoughtful, Appreciative, Trustworthy, Empathetic, Resilient, Sustainable' : '',
    projects: bio ? 'Biotechnology Advocacy Project' : 'Proyek Scratch untuk menyelesaikan masalah atau meningkatkan awareness.',
    projectDescription: bio ? 'Investigate a relevant biotechnology topic and communicate an evidence-based solution to a real audience. Explore traditional fermented foods, sensory evaluation, and nutrition posters.' : 'Membuat animasi atau program Scratch untuk mengatasi masalah, lalu mempresentasikan dan mendemonstrasikan karya.',
    sessions: topics.map((topic, index) => ({ date: sourceDates[index], time: '08:00', topic, phase: index >= 7 ? 'Dedicating' : index < (bio ? 3 : 2) ? 'Inspiring' : 'Creating' })),
  };
}
export function emptyRatings(): Ratings { return { affective: '', problemSolving: '', storytelling: '', performance: '' }; }
export function emptySteps(): LessonStep[] {
  return learningPhases.map((phase) => ({ title: phase === 'Inspiring' ? 'Introduction' : phase === 'Creating' ? 'Investigation & making' : 'Sharing & reflection', phase, minutes: '', purpose: '', teacherActivity: '', studentActivity: '' }));
}
export function semesterRecords(records: TeachingRecord[], classId: string) {
  return records.filter((record) => record.classId === classId && record.kind === 'syllabus' && record.content.sessions?.length && ['Submitted', 'Approved'].includes(record.status)).sort((a, b) => b.date.localeCompare(a.date));
}

export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${date.slice(0, 10)}T12:00:00+07:00`));
}

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function validateDraft(input: RecordDraft, config: TeachingConfig, catalog?: TeachingCatalog) {
  if (!input || !Object.hasOwn(recordLabels, input.kind) || !(catalog?.klasses || teachingClasses).some((item) => item.id === input.classId)) throw new Error('Choose a valid assigned Klass.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || new Date(`${input.date}T12:00:00Z`).toISOString().slice(0, 10) !== input.date) throw new Error('Choose a valid date.');
  if (input.id && !/^[a-f0-9-]{36}$/i.test(input.id)) throw new Error('Invalid record.');
  if (typeof input.submit !== 'boolean' || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 140) throw new Error('Enter a title of up to 140 characters.');
  if (!input.content || typeof input.content !== 'object' || Array.isArray(input.content) || JSON.stringify(input.content).length > 120000) throw new Error('The content is too large.');
  const content = input.content;
  if (content.workflowVersion !== undefined && content.workflowVersion !== 2) throw new Error('Invalid workflow version.');
  if ((content.students !== undefined && input.kind !== 'meeting') || (content.steps !== undefined && input.kind !== 'lesson-plan') || (content.sessions !== undefined && input.kind !== 'syllabus')) throw new Error('The record contains fields for a different document type.');
  if (content.meetingNumber !== undefined && (!Number.isInteger(content.meetingNumber) || content.meetingNumber < 1 || content.meetingNumber > 36)) throw new Error('Choose a valid meeting number.');
  if (content.teacherAttendance !== undefined && !attendanceOptions.includes(content.teacherAttendance)) throw new Error('Select teacher attendance.');
  const text = (key: keyof TeachingContent, required = input.submit) => {
    const value = input.content[key];
    if (value !== undefined && (typeof value !== 'string' || value.length > 6000)) throw new Error('Text fields must be under 6,000 characters.');
    if (required && (typeof value !== 'string' || !value.trim())) throw new Error('Complete the required fields before submitting.');
  };
  if (input.kind === 'meeting') {
    if (!attendanceOptions.includes(input.content.teacherAttendance as Attendance)) throw new Error('Select teacher attendance.');
    const entries = input.content.students;
    const expected = roster(input.classId, catalog);
    if (!Array.isArray(entries) || entries.length !== expected.length || new Set(entries.map((item) => item.id)).size !== expected.length) throw new Error('Complete the student attendance list.');
    for (const entry of entries) {
      if (!expected.some((item) => item.id === entry.id) || !attendanceOptions.includes(entry.attendance) || typeof entry.score !== 'string' || typeof entry.feedback !== 'string' || entry.feedback.length > 2000) throw new Error('Invalid student feedback.');
      if (entry.score !== '' && (!Number.isFinite(Number(entry.score)) || Number(entry.score) < 0 || Number(entry.score) > 100)) throw new Error('Student scores must be between 0 and 100.');
      if (entry.ratings !== undefined) {
        if (!entry.ratings || typeof entry.ratings !== 'object' || Array.isArray(entry.ratings)) throw new Error('Invalid evaluation rubric.');
        for (const key of Object.keys(rubricAspects) as (keyof Ratings)[]) {
          const rating = entry.ratings[key];
          if (typeof rating !== 'string' || (rating !== '' && !/^[1-4]$/.test(rating))) throw new Error('Rubric scores must be whole numbers from 1 to 4.');
        }
      }
      if (input.submit && ['Present', 'Late'].includes(entry.attendance)) {
        const scored = content.workflowVersion === 2 ? entry.ratings && Object.keys(rubricAspects).every((key) => /^[1-4]$/.test(entry.ratings![key as keyof Ratings])) : entry.score.trim();
        if (!scored || !entry.feedback.trim()) throw new Error('Add a score and feedback for each attending student. Complete all four rubric aspects.');
      }
    }
    text('reflection');
  }
  if (input.kind === 'lesson-plan') { text('objectives'); text('activities', content.workflowVersion !== 2 && input.submit); text('resources', content.workflowVersion === 2 && input.submit); }
  if (input.kind === 'syllabus') { text('objectives'); text('outline', content.workflowVersion !== 2 && input.submit); }
  if (input.kind === 'slides') {
    text('canvaUrl', false);
    if (input.submit && !input.content.canvaUrl && !input.files?.some((file) => file.mime === 'application/pdf')) throw new Error('Add a Canva link or slides PDF.');
  }
  if (input.kind === 'request') {
    text('items'); text('reason');
    if (!['Before class', 'Before semester'].includes(input.content.timing || '')) throw new Error('Select a request timeframe.');
  }
  for (const key of ['academicYear', 'semester', 'deadline', 'mainCoach', 'assistantCoach', 'room', 'description', 'values', 'projects', 'projectDescription', 'assessment', 'worksheetUrl', 'notes', 'reflection', 'objectives', 'activities', 'resources', 'outline', 'items', 'reason', 'timing'] as const) text(key, false);
  for (const key of ['canvaUrl', 'worksheetUrl'] as const) {
    text(key, false);
    if (!content[key]) continue;
    const url = new URL(content[key]);
    if (url.protocol !== 'https:' || url.username || url.password || !['canva.com', 'www.canva.com', 'canva.link'].includes(url.hostname)) throw new Error('Use a secure Canva design link.');
  }
  if (content.workflowVersion === 2 && ['meeting', 'lesson-plan', 'slides'].includes(input.kind)) {
    if (!Number.isInteger(content.meetingNumber) || content.meetingNumber! < 1 || content.meetingNumber! > 36) throw new Error('Choose a meeting from the syllabus.');
    if (!content.syllabusId || !/^[a-f0-9-]{36}$/i.test(content.syllabusId)) throw new Error('Submit a syllabus and choose its meeting first.');
    text('mainCoach');
  }
  if (content.syllabusId !== undefined && !/^[a-f0-9-]{36}$/i.test(content.syllabusId)) throw new Error('Invalid syllabus reference.');
  if (input.kind === 'lesson-plan' && (content.workflowVersion === 2 || content.steps !== undefined)) {
    text('assessment');
    if (!Array.isArray(content.steps) || !content.steps.length || content.steps.length > 12) throw new Error('Add between 1 and 12 lesson activities.');
    for (const step of content.steps) {
      if (!step || !lessonPhases.includes(step.phase)) throw new Error('Choose a valid learning phase.');
      for (const key of ['title', 'purpose', 'teacherActivity', 'studentActivity'] as const) {
        if (typeof step[key] !== 'string' || step[key].length > 2000 || (input.submit && !step[key].trim())) throw new Error('Complete the purpose, coach activity, and student activity for every lesson step.');
      }
      if (typeof step.minutes !== 'string' || (step.minutes && (!/^\d+$/.test(step.minutes) || Number(step.minutes) < 1 || Number(step.minutes) > 240)) || (input.submit && !step.minutes)) throw new Error('Set each activity duration between 1 and 240 minutes.');
    }
  }
  if (input.kind === 'syllabus' && (content.workflowVersion === 2 || content.sessions !== undefined)) {
    for (const key of ['academicYear', 'semester', 'mainCoach', 'description', 'projects', 'projectDescription'] as const) text(key);
    if (!content.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(content.deadline) || new Date(`${content.deadline}T12:00:00Z`).toISOString().slice(0, 10) !== content.deadline || content.deadline >= input.date) throw new Error('Choose a submission deadline before the semester starts.');
    if (!Array.isArray(content.sessions) || !content.sessions.length || content.sessions.length > 36) throw new Error('Add between 1 and 36 syllabus meetings.');
    let previous = '';
    for (const session of content.sessions) {
      if (!session || typeof session.topic !== 'string' || session.topic.length > 500 || !learningPhases.includes(session.phase) || !/^\d{2}:\d{2}$/.test(session.time) || Number(session.time.slice(0, 2)) > 23 || Number(session.time.slice(3)) > 59) throw new Error('Complete the meeting topic, time, and learning phase.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date) || new Date(`${session.date}T12:00:00Z`).toISOString().slice(0, 10) !== session.date || session.date < input.date || session.date <= previous) throw new Error('Meeting dates must be valid, chronological, and on or after the semester start.');
      if (input.submit && !session.topic.trim()) throw new Error('Add a topic for every syllabus meeting.');
      previous = session.date;
    }
  }
  if (content.workflowVersion === 2 && input.kind === 'slides' && content.meetingNumber) {
    text('notes');
    const assigned = assignedMaterials(input.classId, content.meetingNumber);
    if ((assigned.canvaUrl && content.canvaUrl !== assigned.canvaUrl) || (assigned.worksheetUrl && content.worksheetUrl !== assigned.worksheetUrl)) throw new Error('Keep the assigned presentation and worksheet links unchanged.');
  }
  if ((input.kind === 'syllabus' && content.workflowVersion !== 2) || (input.kind === 'request' && input.content.timing === 'Before semester' && !content.syllabusId)) {
    if (input.date !== config.semesterStart) throw new Error('Semester submissions must use the semester start date.');
  }
  if (!Array.isArray(input.files) || input.files.length > 4 || input.files.filter((file) => file.mime.startsWith('image/')).length > 3 || input.files.filter((file) => file.mime === 'application/pdf').length > 1) throw new Error('Attach up to three photos and one PDF.');
  for (const file of input.files) {
    if (!file || !/^[a-f0-9-]{36}$/i.test(file.id) || typeof file.name !== 'string' || !file.name || file.name.length > 140 || !['image/webp', 'image/jpeg', 'image/png', 'application/pdf'].includes(file.mime) || !Number.isInteger(file.size) || file.size < 1 || file.size > (file.mime === 'application/pdf' ? 1048576 : 184320)) throw new Error('A file exceeds the upload limit or has an unsupported format.');
    if (file.data && (typeof file.data !== 'string' || file.data.length > 1400000)) throw new Error('The file is too large.');
  }
}

'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadAcademyCatalog } from '@/lib/academy-store';
import { catalogCounts, emptyDeadlines, validDate, type AcademyCatalog, type CatalogKind, type CatalogRecord } from '@/lib/academy';

export async function saveAcademyRecord(kind: CatalogKind, id: string | null, revision: number, input: Record<string, unknown>) {
  await requireRole('admin');
  try {
    if (!['klasses', 'institutions', 'coaches', 'students'].includes(kind) || (id !== null && (typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id))) || !Number.isInteger(revision) || revision < 0 || !input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 30000) throw new Error('Invalid record.');
    const text = (key: string, required = false, max = 140) => {
      const value = input[key] ?? '';
      if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Check ${key}.`);
      return value.trim();
    };
    const image = (key: string, required = false) => {
      const value = text(key, required, 1000);
      if (value && !(/^\/(?!\/)[\w /%().-]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(value) || /^https:\/\//.test(value))) throw new Error('Use a local image path or an HTTPS image URL.');
      if (value.startsWith('https:')) { const url = new URL(value); if (url.username || url.password) throw new Error('Invalid image URL.'); }
      return value;
    };
    const email = (key: string, required = false) => {
      const value = text(key, required, 200).toLowerCase();
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid email address.');
      return value;
    };
    const sql = db();
    await loadAcademyCatalog();
    const catalog = await sql.begin(async (tx) => {
      // ponytail: one locked pilot catalog; use relational tables if catalog size or write contention grows.
      const [row] = await tx`SELECT content FROM academy_catalog WHERE id = 1 FOR UPDATE`;
      const current = row.content as AcademyCatalog;
      const existing = current[kind].find((record) => record.id === id);
      if (id && (!existing || (existing.revision || 0) !== revision)) throw new Error('This record changed. Refresh the page before editing again.');
      if (current[kind].length >= 1000 && !id) throw new Error('The pilot catalog is full.');
      const ids = (key: string, records: { id: string }[]) => {
        const values = input[key] ?? [];
        if (!Array.isArray(values) || values.length > records.length || values.some((value) => typeof value !== 'string' || !records.some((record) => record.id === value)) || new Set(values).size !== values.length) throw new Error(`Check ${key}.`);
        return values as string[];
      };
      const institutionId = () => {
        const value = text('institutionId');
        if (value && !current.institutions.some((record) => record.id === value)) throw new Error('Select an existing institution.');
        return value;
      };
      const createId = text('createId');
      if (!id && (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(createId) || current[kind].some((item) => item.id === createId))) throw new Error('This record may already be saved. Refresh the page before adding it again.');
      const base = { id: id || createId, revision: (existing?.revision || 0) + 1 };
      let record: CatalogRecord;
      if (kind === 'klasses') {
        const mode = text('mode');
        if (!['Online', 'Onsite', 'Hybrid'].includes(mode)) throw new Error('Select a delivery mode.');
        const deadlines = input.deadlines as ReturnType<typeof emptyDeadlines>;
        if (!deadlines || typeof deadlines !== 'object' || !Array.isArray(deadlines.meetings) || deadlines.meetings.length > 72 || (deadlines.semesterStart !== '' && !validDate(deadlines.semesterStart)) || (deadlines.syllabus !== '' && !validDate(deadlines.syllabus)) || Boolean(deadlines.syllabus) !== Boolean(deadlines.semesterStart) || (deadlines.syllabus && deadlines.syllabus >= deadlines.semesterStart)) throw new Error('Set the syllabus deadline before the semester start, or leave both empty.');
        if (new Set(deadlines.meetings.map((meeting) => meeting?.date)).size !== deadlines.meetings.length || deadlines.meetings.some((meeting) => !meeting || !validDate(meeting.date) || (meeting.lessonPlan !== '' && (!validDate(meeting.lessonPlan) || meeting.lessonPlan > meeting.date)) || (meeting.feedback !== '' && (!validDate(meeting.feedback) || meeting.feedback < meeting.date)))) throw new Error('Check meeting deadlines: lesson plan on/before the meeting, feedback on/after it.');
        record = { ...base, title: text('title', true), category: text('category', true), institutionId: institutionId(), mode: mode as 'Online' | 'Onsite' | 'Hybrid', image: image('image', true), schedule: text('schedule', true), description: text('description', true, 3000), coachIds: ids('coachIds', current.coaches), deadlines: { semesterStart: deadlines.semesterStart, syllabus: deadlines.syllabus, meetings: deadlines.meetings.map(({ date, lessonPlan, feedback }) => ({ date, lessonPlan, feedback })) }, school: '', coaches: [], students: 0 };
      } else if (kind === 'institutions') {
        const website = text('website', false, 1000);
        if (website && (!/^https:\/\//.test(website) || new URL(website).username || new URL(website).password)) throw new Error('Use an HTTPS website URL.');
        const phone = text('phone', false, 40);
        if (phone && !/^\+?[\d ()-]{6,40}$/.test(phone)) throw new Error('Enter a valid contact number.');
        record = { ...base, name: text('name', true), city: text('city', true), country: text('country', true), logo: image('logo'), address: text('address', false, 500), contactName: text('contactName'), email: email('email'), phone, website, about: '', classes: 0, students: 0 };
      } else if (kind === 'coaches') {
        const level = text('level');
        if (!['Lead Coach', 'Coach'].includes(level)) throw new Error('Select a coach level.');
        const portalEmail = email('portalEmail');
        if (portalEmail && !(await tx`SELECT email FROM portal_users WHERE email = ${portalEmail} AND role = 'teacher'`).length) throw new Error('The portal account must be an existing teacher account.');
        record = { ...base, name: text('name', true), specialty: text('specialty', true), level: level as 'Coach' | 'Lead Coach', image: image('image'), email: email('email', true), portalEmail, bio: text('bio', false, 3000), classes: 0, students: 0 };
      } else {
        record = { ...base, name: text('name', true), grade: text('grade', true, 40), institutionId: institutionId(), classIds: ids('classIds', current.klasses), school: '', klass: '', score: existing && 'score' in existing ? existing.score : 0, attendance: existing && 'attendance' in existing ? existing.attendance : 0 };
      }
      const updated = { ...current, [kind]: id ? current[kind].map((item) => item.id === id ? record : item) : [...current[kind], record] } as AcademyCatalog;
      if (kind === 'klasses') {
        const enrolled = ids('studentIds', current.students);
        updated.students = current.students.map((student) => {
          const before = student.classIds || [];
          const shouldEnroll = enrolled.includes(student.id);
          return before.includes(record.id) === shouldEnroll ? student : { ...student, classIds: shouldEnroll ? [...before, record.id] : before.filter((classId) => classId !== record.id), revision: (student.revision || 0) + 1 };
        });
      }
      if (kind === 'students' && 'classIds' in record) {
        const before = existing && 'classIds' in existing ? existing.classIds || [] : [];
        updated.klasses = current.klasses.map((klass) => before.includes(klass.id) === record.classIds?.includes(klass.id) ? klass : { ...klass, revision: (klass.revision || 0) + 1 });
      }
      const next = catalogCounts(updated);
      await tx`UPDATE academy_catalog SET content = ${sql.json(next)}, updated_at = NOW() WHERE id = 1`;
      return next;
    });
    return { ok: true as const, catalog };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not save. Your form is unchanged; please retry.' };
  }
}

'use server';

import { randomUUID } from 'node:crypto';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { readAcademyCatalog } from '@/lib/academy-store';
import { catalogCounts, emptyDeadlines, validDate, type AcademyCatalog, type CatalogKind, type CatalogRecord } from '@/lib/academy';
import { processAcademyImage } from '@/lib/academy-image';
import { writeAcademicCore } from '@/lib/academic-core';
import { stagePrivateFile } from '@/lib/private-files.mjs';
import { portalLimit } from '@/lib/portal-limits';

export async function saveAcademyRecord(kind: CatalogKind, id: string | null, revision: number, input: Record<string, unknown>) {
  const session = await requireRole('admin');
  try {
    if (!['klasses', 'institutions', 'coaches', 'students'].includes(kind) || (id !== null && (typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id))) || !Number.isInteger(revision) || revision < 0 || !input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 350000) throw new Error('Invalid record.');
    const text = (key: string, required = false, max = 140) => {
      const value = input[key] ?? '';
      if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Check ${key}.`);
      return value.trim();
    };
    const email = (key: string, required = false) => {
      const value = text(key, required, 200).toLowerCase();
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid email address.');
      return value;
    };
    const sql = db();
    const createId = text('createId');
    const requestedType = kind === 'klasses' ? text('klassTypeId', false, 80) : '';
    if (!id && requestedType && input.imageUpload) throw new Error('Edit the existing Klass type to change its shared image.');
    const checkExisting = (current: AcademyCatalog) => {
      const existing = current[kind].find((record) => record.id === id);
      if (id && (!existing || (existing.revision || 0) !== revision)) throw new Error('This record changed. Refresh the page before editing again.');
      if (current[kind].length >= 1000 && !id) throw new Error('The pilot catalog is full.');
      if (!id && (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(createId) || current[kind].some((item) => item.id === createId))) throw new Error('This record may already be saved. Refresh the page before adding it again.');
      return existing;
    };
    const uploadKey = kind === 'institutions' ? 'logoUpload' : kind === 'klasses' || kind === 'coaches' ? 'imageUpload' : null;
    if (uploadKey && input[uploadKey]) {
      checkExisting(await sql.begin(readAcademyCatalog));
      if (!(await portalLimit('catalog:upload', session.email, 20, 900))) throw new Error('Too many uploads. Wait 15 minutes before trying again.');
    }
    const processed = uploadKey && input[uploadKey] ? await processAcademyImage(input[uploadKey]) : null;
    const objectId = processed ? await stagePrivateFile(sql, processed) : null;
    const catalog = await sql.begin(async (tx) => {
      await tx`SELECT id FROM academy_core_state WHERE id = 1 FOR UPDATE`;
      const current = await readAcademyCatalog(tx);
      const existing = checkExisting(current);
      const storedImage = async (key: 'image' | 'logo', required = false) => {
        const existingImage = existing as (CatalogRecord & Partial<Record<'image' | 'logo', string>>) | undefined;
        const previous = existingImage?.[key] || '';
        const supplied = text(key, false, 1000);
        const upload = input[`${key}Upload`];
        if (!upload) {
          if (supplied !== previous) throw new Error('Choose an image file instead of entering a path or URL.');
          if (required && !previous) throw new Error('Choose an image file.');
          return previous;
        }
        if (!processed || !objectId) throw new Error('Choose a valid image file.');
        const imageId = randomUUID();
        await tx`INSERT INTO academy_images (id, name, mime, object_id) VALUES (${imageId}, ${processed.name}, ${processed.mime}, ${objectId})`;
        return `/api/academy-images/${imageId}`;
      };
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
      const base = { id: id || createId, revision: (existing?.revision || 0) + 1 };
      let record: CatalogRecord;
      if (kind === 'klasses') {
        const storedType = existing && 'klassTypeId' in existing ? existing.klassTypeId || existing.id : '';
        if (id && requestedType && requestedType !== storedType) throw new Error('An existing group must keep its Klass type.');
        const source = !id && requestedType ? current.klasses.find((klass) => (klass.klassTypeId || klass.id) === requestedType) : undefined;
        if (!id && requestedType && !source) throw new Error('Select an existing Klass type.');
        const shared = source
          ? { title: source.title, category: source.category, description: source.description, image: source.image }
          : { title: text('title', true), category: text('category', true), description: text('description', true, 3000), image: await storedImage('image', true) };
        const mode = text('mode');
        if (!['Online', 'Onsite', 'Hybrid'].includes(mode)) throw new Error('Select a delivery mode.');
        const supplied = input.deadlines as ReturnType<typeof emptyDeadlines>;
        const previous = existing && 'deadlines' in existing ? existing.deadlines : undefined;
        const deadlines = supplied && { ...supplied, semesterRequest: supplied.semesterRequest ?? previous?.semesterRequest ?? '', meetings: Array.isArray(supplied.meetings) ? supplied.meetings.map((meeting) => ({ ...meeting, request: meeting?.request ?? previous?.meetings.find((entry) => entry.date === meeting?.date)?.request ?? '' })) : supplied.meetings };
        if (!deadlines || typeof deadlines !== 'object' || !Array.isArray(deadlines.meetings) || deadlines.meetings.length > 72 || (deadlines.semesterStart !== '' && !validDate(deadlines.semesterStart)) || (deadlines.syllabus !== '' && !validDate(deadlines.syllabus)) || Boolean(deadlines.syllabus) !== Boolean(deadlines.semesterStart) || (deadlines.syllabus && deadlines.syllabus >= deadlines.semesterStart)) throw new Error('Set the syllabus deadline before the semester start, or leave both empty.');
        if (new Set(deadlines.meetings.map((meeting) => meeting?.date)).size !== deadlines.meetings.length || deadlines.meetings.some((meeting) => !meeting || !validDate(meeting.date) || (meeting.lessonPlan !== '' && (!validDate(meeting.lessonPlan) || meeting.lessonPlan > meeting.date)) || (meeting.feedback !== '' && (!validDate(meeting.feedback) || meeting.feedback < meeting.date)))) throw new Error('Check meeting deadlines: lesson plan on/before the meeting, feedback on/after it.');
        if ((deadlines.semesterRequest !== '' && (!validDate(deadlines.semesterRequest) || !deadlines.semesterStart || deadlines.semesterRequest >= deadlines.semesterStart)) || deadlines.meetings.some((meeting) => meeting.request !== '' && (!validDate(meeting.request) || meeting.request >= meeting.date))) throw new Error('Class needs deadlines must be before the class or semester starts.');
        // shortcut: one request per teacher/Klass/date; combine first-meeting and semester needs until separate request instances exist.
        if (deadlines.semesterRequest && deadlines.meetings.some((meeting) => meeting.date === deadlines.semesterStart && meeting.request)) throw new Error('Use one class needs deadline for the semester-start date. Combine those needs in one request.');
        record = { ...base, ...shared, klassTypeId: storedType || requestedType || base.id, institutionId: institutionId(), mode: mode as 'Online' | 'Onsite' | 'Hybrid', schedule: text('schedule', true), coachIds: ids('coachIds', current.coaches), deadlines: { semesterStart: deadlines.semesterStart, syllabus: deadlines.syllabus, semesterRequest: deadlines.semesterRequest, meetings: deadlines.meetings.map(({ date, lessonPlan, feedback, request }) => ({ date, lessonPlan, feedback, request })) }, school: '', coaches: [], students: 0 };
      } else if (kind === 'institutions') {
        const website = text('website', false, 1000);
        if (website && (!/^https:\/\//.test(website) || new URL(website).username || new URL(website).password)) throw new Error('Use an HTTPS website URL.');
        const phone = text('phone', false, 40);
        if (phone && !/^\+?[\d ()-]{6,40}$/.test(phone)) throw new Error('Enter a valid contact number.');
        record = { ...base, name: text('name', true), city: text('city', true), country: text('country', true), logo: await storedImage('logo'), address: text('address', false, 500), contactName: text('contactName'), email: email('email'), phone, website, about: '', classes: 0, students: 0 };
      } else if (kind === 'coaches') {
        const level = text('level');
        if (!['Lead Coach', 'Coach'].includes(level)) throw new Error('Select a coach level.');
        const portalEmail = email('portalEmail');
        const previousEmail = existing && 'portalEmail' in existing ? existing.portalEmail : '';
        if (portalEmail && portalEmail !== previousEmail && !(await tx`SELECT email FROM portal_users WHERE email = ${portalEmail} AND role = 'teacher' AND status = 'active' FOR SHARE`).length) throw new Error('The portal account must be an approved, active teacher account.');
        record = { ...base, name: text('name', true), specialty: text('specialty', true), level: level as 'Coach' | 'Lead Coach', image: await storedImage('image'), email: email('email', true), portalEmail, bio: text('bio', false, 3000), classes: 0, students: 0 };
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
      await writeAcademicCore(tx, next, current);
      await tx`INSERT INTO academy_events (id, actor_email, entity_kind, entity_id, action, before_data, after_data) VALUES (${randomUUID()}, ${session.email}, ${kind}, ${record.id}, ${existing ? 'update' : 'create'}, ${tx.json(existing || {})}, ${tx.json(record)})`;
      const previousImage = existing && 'logo' in existing ? existing.logo : existing && 'image' in existing ? existing.image : '';
      const nextImage = 'logo' in record ? record.logo : 'image' in record ? record.image : '';
      const managed = typeof previousImage === 'string' && /^\/api\/academy-images\/([a-f0-9-]{36})$/i.exec(previousImage);
      if (managed && previousImage !== nextImage) await tx`DELETE FROM academy_images WHERE id = ${managed[1]}`;
      return readAcademyCatalog(tx);
    });
    return { ok: true as const, catalog };
  } catch (error) {
    console.error('Catalog save failed', error instanceof Error ? error.message : 'Unknown error');
    return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not save. Your form is unchanged; please retry.' };
  }
}

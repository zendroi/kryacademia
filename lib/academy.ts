import { klasses, coaches, students, institutions, type KlassRecord, type CoachRecord, type StudentRecord, type InstitutionRecord } from '@/app/admin/adminData';
import type { TeachingRecord } from '@/app/teacher/teacherData';

export type AcademyCatalog = { klasses: KlassRecord[]; coaches: CoachRecord[]; students: StudentRecord[]; institutions: InstitutionRecord[] };
export type CatalogKind = keyof AcademyCatalog;
export type CatalogRecord = KlassRecord | CoachRecord | StudentRecord | InstitutionRecord;
export type TeachingCatalog = Pick<AcademyCatalog, 'klasses' | 'students'>;
export const emptyDeadlines = () => ({ semesterStart: '', syllabus: '', meetings: [] as NonNullable<KlassRecord['deadlines']>['meetings'] });

export function catalogCounts(catalog: AcademyCatalog): AcademyCatalog {
  const assigned = (id: string) => catalog.klasses.filter((klass) => klass.coachIds?.includes(id));
  return {
    ...catalog,
    klasses: catalog.klasses.map((klass) => ({ ...klass, school: catalog.institutions.find((item) => item.id === klass.institutionId)?.name || 'KRYAcademia', coaches: catalog.coaches.filter((coach) => klass.coachIds?.includes(coach.id)).map((coach) => coach.name), students: catalog.students.filter((student) => student.classIds?.includes(klass.id)).length })),
    students: catalog.students.map((student) => ({ ...student, school: catalog.institutions.find((item) => item.id === student.institutionId)?.name || 'Independent', klass: catalog.klasses.filter((klass) => student.classIds?.includes(klass.id)).map((klass) => klass.title).join(' / ') || 'Not assigned' })),
    coaches: catalog.coaches.map((coach) => ({ ...coach, classes: assigned(coach.id).length, students: catalog.students.filter((student) => assigned(coach.id).some((klass) => student.classIds?.includes(klass.id))).length })),
    institutions: catalog.institutions.map((institution) => ({ ...institution, classes: catalog.klasses.filter((klass) => klass.institutionId === institution.id).length, students: catalog.students.filter((student) => student.institutionId === institution.id).length })),
  };
}

export function seedCatalog(): AcademyCatalog {
  return catalogCounts({
    klasses: klasses.map((klass) => ({ ...klass, institutionId: institutions.find((item) => item.name === klass.school)?.id || '', coachIds: coaches.filter((coach) => klass.coaches.includes(coach.name)).map((coach) => coach.id), deadlines: emptyDeadlines(), revision: 0 })),
    // Preserve the pilot teacher's three existing demo assignments until admin assigns real accounts.
    coaches: coaches.map((coach) => ({ ...coach, portalEmail: ['rahayu', 'wahyu', 'gabriel'].includes(coach.id) ? 'teacher@krya.global' : '', revision: 0 })),
    students: students.map((student) => ({ ...student, institutionId: institutions.find((item) => item.name === student.school)?.id || '', classIds: klasses.filter((klass) => klass.title === student.klass).map((klass) => klass.id), revision: 0 })),
    institutions: institutions.map((item) => ({ ...item, country: 'Indonesia', address: '', contactName: '', email: '', phone: '', website: '', revision: 0 })),
  });
}

export function assignedCatalog(catalog: AcademyCatalog, email: string): TeachingCatalog {
  const ids = catalog.coaches.filter((coach) => coach.portalEmail === email).map((coach) => coach.id);
  const assigned = catalog.klasses.filter((klass) => klass.coachIds?.some((id) => ids.includes(id)));
  return { klasses: assigned, students: catalog.students.filter((student) => student.classIds?.some((id) => assigned.some((klass) => klass.id === id))).map((student) => ({ ...student, classIds: student.classIds?.filter((id) => assigned.some((klass) => klass.id === id)), klass: assigned.filter((klass) => student.classIds?.includes(klass.id)).map((klass) => klass.title).join(' / ') })) };
}

export function approvedSyllabuses(records: TeachingRecord[], classId: string) {
  return records.filter((record) => record.kind === 'syllabus' && record.classId === classId && record.status === 'Approved').sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export function coachTasks(coach: CoachRecord, catalog: AcademyCatalog, records: TeachingRecord[], date: string) {
  const tasks: { classId: string; klass: string; label: string; date: string; deadline: string; status: string; overdue: boolean }[] = [];
  if (!coach.portalEmail) return tasks;
  for (const klass of catalog.klasses.filter((item) => item.coachIds?.includes(coach.id))) {
    for (const entry of classDeadlines(klass)) {
      const record = records.find((record) => record.teacherEmail === coach.portalEmail && record.classId === klass.id && record.kind === entry.kind && record.date === entry.date);
      if (record && ['Submitted', 'Approved', 'Fulfilled'].includes(record.status)) continue;
      tasks.push({ classId: klass.id, klass: klass.title, label: entry.label, date: entry.date, deadline: entry.deadline, status: record?.status || 'Not started', overdue: date > entry.deadline });
    }
  }
  return tasks.sort((a, b) => a.deadline.localeCompare(b.deadline));
}

export function classDeadlines(klass: KlassRecord) {
  const deadlines = klass.deadlines;
  return !deadlines ? [] : [
      ...(deadlines.syllabus ? [{ kind: 'syllabus', label: 'Syllabus', date: deadlines.semesterStart, deadline: deadlines.syllabus }] : []),
      ...deadlines.meetings.flatMap((meeting) => [
        ...(meeting.lessonPlan ? [{ kind: 'lesson-plan', label: 'Lesson plan', date: meeting.date, deadline: meeting.lessonPlan }] : []),
        ...(meeting.feedback ? [{ kind: 'meeting', label: 'Feedback & attendance', date: meeting.date, deadline: meeting.feedback }] : []),
      ]),
    ];
}

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

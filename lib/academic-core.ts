import 'server-only';
import type postgres from 'postgres';
import { catalogCounts, emptyDeadlines, seedCatalog, type AcademyCatalog } from './academy';
import type { CoachRecord, InstitutionRecord, KlassRecord, StudentRecord } from '@/app/admin/adminData';

type Transaction = postgres.TransactionSql;

function periodId(classId: string, start: string) {
  return `period:${classId}:${start}`;
}

export async function writeAcademicCore(tx: Transaction, catalog: AcademyCatalog, previous?: AcademyCatalog) {
  const changed = <T extends { id: string }>(items: T[], before: T[] = []) => items.filter((item) => JSON.stringify(before.find((entry) => entry.id === item.id)) !== JSON.stringify(item));
  const edited = {
    institutions: changed(catalog.institutions, previous?.institutions), coaches: changed(catalog.coaches, previous?.coaches),
    students: changed(catalog.students, previous?.students), klasses: changed(catalog.klasses, previous?.klasses),
  };
  if (!previous) {
    await tx`UPDATE institutions SET active = FALSE`;
    await tx`UPDATE klass_types SET active = FALSE`;
    await tx`UPDATE coach_profiles SET active = FALSE`;
    await tx`UPDATE student_profiles SET active = FALSE`;
    await tx`UPDATE class_groups SET active = FALSE`;
    await tx`DELETE FROM submission_deadlines WHERE kind != 'request' OR request_timing != ''`;
    await tx`DELETE FROM class_schedules`;
    await tx`DELETE FROM coach_assignments`;
    await tx`UPDATE enrollments SET status = 'withdrawn'`;
    await tx`UPDATE class_meetings SET configured = FALSE`;
  }

  const institutions = edited.institutions.map((item) => ({ id: item.id, name: item.name, city: item.city, country: item.country || 'Indonesia', logo: item.logo, about: item.about, address: item.address || '', contact_name: item.contactName || '', email: item.email || '', phone: item.phone || '', website: item.website || '', sort_order: catalog.institutions.findIndex((entry) => entry.id === item.id), revision: item.revision || 0, active: true }));
  if (institutions.length) await tx`
    INSERT INTO institutions ${tx(institutions)}
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, country = EXCLUDED.country, logo = EXCLUDED.logo, about = EXCLUDED.about, address = EXCLUDED.address, contact_name = EXCLUDED.contact_name, email = EXCLUDED.email, phone = EXCLUDED.phone, website = EXCLUDED.website, sort_order = EXCLUDED.sort_order, revision = EXCLUDED.revision, active = TRUE, updated_at = NOW()
  `;
  const coaches = edited.coaches.map((coach) => ({ id: coach.id, name: coach.name, specialty: coach.specialty, level: coach.level, image: coach.image, email: coach.email, portal_email: coach.portalEmail || '', bio: coach.bio, sort_order: catalog.coaches.findIndex((entry) => entry.id === coach.id), revision: coach.revision || 0, active: true }));
  if (coaches.length) await tx`
    INSERT INTO coach_profiles ${tx(coaches)}
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, specialty = EXCLUDED.specialty, level = EXCLUDED.level, image = EXCLUDED.image, email = EXCLUDED.email, portal_email = EXCLUDED.portal_email, bio = EXCLUDED.bio, sort_order = EXCLUDED.sort_order, revision = EXCLUDED.revision, active = TRUE, updated_at = NOW()
  `;
  const klassTypes = [...new Map(edited.klasses.map((klass) => [klass.klassTypeId || klass.id, { id: klass.klassTypeId || klass.id, title: klass.title, category: klass.category, description: klass.description, image: klass.image, sort_order: catalog.klasses.findIndex((entry) => entry.id === klass.id), active: true }])).values()];
  const changedTypes = klassTypes.filter((type) => {
    const before = previous?.klasses.find((klass) => (klass.klassTypeId || klass.id) === type.id);
    return before && (['title', 'category', 'description', 'image'] as const).some((key) => before[key] !== type[key]);
  }).map((type) => type.id);
  if (klassTypes.length) await tx`
    INSERT INTO klass_types ${tx(klassTypes)}
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, description = EXCLUDED.description, image = EXCLUDED.image, sort_order = EXCLUDED.sort_order, active = TRUE, updated_at = NOW()
  `;
  const students = edited.students.map((student) => ({ id: student.id, institution_id: student.institutionId || null, name: student.name, grade: student.grade, score: student.score || 0, attendance: student.attendance || 0, sort_order: catalog.students.findIndex((entry) => entry.id === student.id), revision: student.revision || 0, active: true }));
  if (students.length) await tx`
    INSERT INTO student_profiles ${tx(students)}
    ON CONFLICT (id) DO UPDATE SET institution_id = EXCLUDED.institution_id, name = EXCLUDED.name, grade = EXCLUDED.grade, score = EXCLUDED.score, attendance = EXCLUDED.attendance, sort_order = EXCLUDED.sort_order, revision = EXCLUDED.revision, active = TRUE, updated_at = NOW()
  `;

  const periods = edited.klasses.flatMap((klass) => {
    const deadlines = klass.deadlines || emptyDeadlines();
    return deadlines.semesterStart ? [{ id: periodId(klass.id, deadlines.semesterStart), institution_id: klass.institutionId || null, name: `Semester starting ${deadlines.semesterStart}`, start_date: deadlines.semesterStart, active: true }] : [];
  });
  if (periods.length) await tx`INSERT INTO academic_periods ${tx(periods)} ON CONFLICT (id) DO UPDATE SET institution_id = EXCLUDED.institution_id, active = TRUE`;
  const groups = edited.klasses.map((klass) => ({ id: klass.id, klass_type_id: klass.klassTypeId || klass.id, institution_id: klass.institutionId || null, academic_period_id: klass.deadlines?.semesterStart ? periodId(klass.id, klass.deadlines.semesterStart) : null, mode: klass.mode, sort_order: catalog.klasses.findIndex((entry) => entry.id === klass.id), revision: klass.revision || 0, active: true }));
  if (groups.length) await tx`
      INSERT INTO class_groups ${tx(groups)}
      ON CONFLICT (id) DO UPDATE SET institution_id = EXCLUDED.institution_id, academic_period_id = EXCLUDED.academic_period_id, mode = EXCLUDED.mode, sort_order = EXCLUDED.sort_order, revision = EXCLUDED.revision, active = TRUE, updated_at = NOW()
  `;
  // A shared type edit also invalidates open forms for its other groups.
  if (changedTypes.length) await tx`UPDATE class_groups SET revision = revision + 1, updated_at = NOW() WHERE klass_type_id IN ${tx(changedTypes)} AND id NOT IN ${tx(groups.map((group) => group.id))}`;
  const assignments = edited.klasses.flatMap((klass) => (klass.coachIds || []).map((coach_id) => ({ class_group_id: klass.id, coach_id })));
  if (edited.klasses.length) {
    const ids = edited.klasses.map((klass) => klass.id);
    await tx`DELETE FROM coach_assignments a WHERE class_group_id IN ${tx(ids)} AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(${tx.json(assignments)}) AS keep(class_group_id TEXT, coach_id TEXT) WHERE keep.class_group_id = a.class_group_id AND keep.coach_id = a.coach_id)`;
    await tx`DELETE FROM submission_deadlines WHERE class_group_id IN ${tx(ids)} AND (kind != 'request' OR request_timing != '')`;
    await tx`UPDATE class_meetings SET configured = FALSE WHERE class_group_id IN ${tx(ids)}`;
  }
  const schedules = edited.klasses.map((klass) => ({ class_group_id: klass.id, schedule_text: klass.schedule }));
  if (schedules.length) await tx`INSERT INTO class_schedules ${tx(schedules)} ON CONFLICT (class_group_id) DO UPDATE SET schedule_text = EXCLUDED.schedule_text`;
  if (assignments.length) await tx`INSERT INTO coach_assignments ${tx(assignments)} ON CONFLICT (class_group_id, coach_id) DO NOTHING`;
  if (edited.students.length) await tx`UPDATE enrollments SET status = 'withdrawn' WHERE student_id IN ${tx(edited.students.map((student) => student.id))}`;
  const enrollments = edited.students.flatMap((student) => (student.classIds || []).map((class_group_id) => ({ class_group_id, student_id: student.id, status: 'active' })));
  if (enrollments.length) await tx`INSERT INTO enrollments ${tx(enrollments)} ON CONFLICT (class_group_id, student_id) DO UPDATE SET status = 'active'`;
  const meetings = edited.klasses.flatMap((klass) => (klass.deadlines?.meetings || []).map((meeting) => ({ class_group_id: klass.id, meeting_date: meeting.date, configured: true })));
  if (meetings.length) await tx`INSERT INTO class_meetings ${tx(meetings)} ON CONFLICT (class_group_id, meeting_date) DO UPDATE SET configured = TRUE`;
  const submissionDeadlines = edited.klasses.flatMap((klass) => {
    const deadlines = klass.deadlines || emptyDeadlines();
    const academic_period_id = deadlines.semesterStart ? periodId(klass.id, deadlines.semesterStart) : null;
    return [
        ...(deadlines.syllabus && deadlines.semesterStart ? [{ id: `deadline:${klass.id}:syllabus:${deadlines.semesterStart}`, class_group_id: klass.id, academic_period_id, kind: 'syllabus', request_timing: '', meeting_date: deadlines.semesterStart, due_date: deadlines.syllabus }] : []),
        ...(deadlines.semesterRequest && deadlines.semesterStart ? [{ id: `deadline:${klass.id}:request-semester:${deadlines.semesterStart}`, class_group_id: klass.id, academic_period_id, kind: 'request', request_timing: 'Before semester', meeting_date: deadlines.semesterStart, due_date: deadlines.semesterRequest }] : []),
      ...deadlines.meetings.flatMap((meeting) => [
          ...(meeting.lessonPlan ? [{ id: `deadline:${klass.id}:lesson-plan:${meeting.date}`, class_group_id: klass.id, academic_period_id, kind: 'lesson-plan', request_timing: '', meeting_date: meeting.date, due_date: meeting.lessonPlan }] : []),
          ...(meeting.feedback ? [{ id: `deadline:${klass.id}:meeting:${meeting.date}`, class_group_id: klass.id, academic_period_id, kind: 'meeting', request_timing: '', meeting_date: meeting.date, due_date: meeting.feedback }] : []),
          ...(meeting.request ? [{ id: `deadline:${klass.id}:request-meeting:${meeting.date}`, class_group_id: klass.id, academic_period_id, kind: 'request', request_timing: 'Before class', meeting_date: meeting.date, due_date: meeting.request }] : []),
      ]),
    ];
  });
  if (submissionDeadlines.length) await tx`INSERT INTO submission_deadlines ${tx(submissionDeadlines)}`;
}

export async function initializeAcademicCore(tx: Transaction) {
  const [state] = await tx`SELECT relational_ready FROM academy_core_state WHERE id = 1 FOR UPDATE`;
  if (state?.relational_ready) return;
  await tx`INSERT INTO academy_catalog (id, content) VALUES (1, ${tx.json(seedCatalog())}) ON CONFLICT (id) DO NOTHING`;
  const [row] = await tx`SELECT content, md5(content::text) AS hash FROM academy_catalog WHERE id = 1 FOR UPDATE`;
  await writeAcademicCore(tx, row.content as AcademyCatalog);
  await tx`UPDATE academy_core_state SET relational_ready = TRUE, catalog_hash = ${row.hash}, synced_at = NOW() WHERE id = 1`;
}

export async function readAcademicCore(tx: Transaction): Promise<AcademyCatalog> {
  const institutions = await tx<Omit<InstitutionRecord, 'classes' | 'students'>[]>`SELECT id, name, city, country, logo, about, address, contact_name AS "contactName", email, phone, website, revision FROM institutions WHERE active ORDER BY sort_order`;
  const coaches = await tx<(Omit<CoachRecord, 'classes' | 'students' | 'level'> & { level: string })[]>`SELECT id, name, specialty, level, image, email, portal_email AS "portalEmail", bio, revision FROM coach_profiles WHERE active ORDER BY sort_order`;
  const groups = await tx<(Omit<KlassRecord, 'school' | 'coaches' | 'students' | 'coachIds' | 'deadlines' | 'mode'> & { mode: string; semesterStart: string | null })[]>`
    SELECT g.id, g.klass_type_id AS "klassTypeId", COALESCE(g.institution_id, '') AS "institutionId", g.mode, g.revision, t.title, t.category, t.description, t.image,
      COALESCE(s.schedule_text, '') AS schedule, p.start_date::text AS "semesterStart"
    FROM class_groups g JOIN klass_types t ON t.id = g.klass_type_id
    LEFT JOIN class_schedules s ON s.class_group_id = g.id
    LEFT JOIN academic_periods p ON p.id = g.academic_period_id
    WHERE g.active AND t.active ORDER BY g.sort_order
  `;
  const assignments = await tx<{ classId: string; coachId: string }[]>`SELECT class_group_id AS "classId", coach_id AS "coachId" FROM coach_assignments`;
  const students = await tx<Omit<StudentRecord, 'school' | 'klass' | 'classIds'>[]>`SELECT id, COALESCE(institution_id, '') AS "institutionId", name, grade, score, attendance, revision FROM student_profiles WHERE active ORDER BY sort_order`;
  const enrollments = await tx<{ classId: string; studentId: string }[]>`SELECT class_group_id AS "classId", student_id AS "studentId" FROM enrollments WHERE status = 'active'`;
  const deadlines = await tx<{ classId: string; kind: 'syllabus' | 'lesson-plan' | 'meeting' | 'request'; date: string; dueDate: string; timing: string }[]>`SELECT class_group_id AS "classId", kind, meeting_date::text AS date, due_date::text AS "dueDate", request_timing AS timing FROM submission_deadlines ORDER BY meeting_date, kind`;

  const configured = await tx<{ classId: string; date: string }[]>`SELECT class_group_id AS "classId", meeting_date::text AS date FROM class_meetings WHERE configured ORDER BY meeting_date`;
  const catalog: AcademyCatalog = {
    institutions: institutions.map((item) => ({ ...item, classes: 0, students: 0 })),
    coaches: coaches.map((item) => ({ ...item, level: item.level as 'Lead Coach' | 'Coach', classes: 0, students: 0 })),
    students: students.map((student) => ({ ...student, school: '', klass: '', classIds: enrollments.filter((entry) => entry.studentId === student.id).map((entry) => entry.classId) })),
    klasses: groups.map(({ semesterStart, ...group }) => {
      const items = deadlines.filter((entry) => entry.classId === group.id);
      const meetings = configured.filter((entry) => entry.classId === group.id).map((entry) => entry.date).map((date) => ({ date, lessonPlan: items.find((entry) => entry.kind === 'lesson-plan' && entry.date === date)?.dueDate || '', feedback: items.find((entry) => entry.kind === 'meeting' && entry.date === date)?.dueDate || '', request: items.find((entry) => entry.kind === 'request' && entry.timing === 'Before class' && entry.date === date)?.dueDate || '' }));
      return { ...group, mode: group.mode as 'Online' | 'Onsite' | 'Hybrid', school: '', coaches: [], students: 0, coachIds: assignments.filter((entry) => entry.classId === group.id).map((entry) => entry.coachId), deadlines: { semesterStart: semesterStart || '', syllabus: items.find((entry) => entry.kind === 'syllabus')?.dueDate || '', semesterRequest: items.find((entry) => entry.kind === 'request' && entry.timing === 'Before semester')?.dueDate || '', meetings } };
    }),
  };
  return catalogCounts(catalog);
}

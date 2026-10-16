import 'server-only';
import type postgres from 'postgres';
import type { RecordKind, TeachingContent } from '@/app/teacher/teacherData';

type Transaction = postgres.TransactionSql;
type WorkflowRecord = { id: string; classId: string; kind: RecordKind; date: string; content: TeachingContent };

export async function writeTeachingWorkflow(tx: Transaction, record: WorkflowRecord) {
  const c = record.content;
  const fields = { record_id: record.id, workflow_version: c.workflowVersion ?? null, syllabus_id: c.syllabusId || null, meeting_number: c.meetingNumber ?? null, main_coach: c.mainCoach ?? null, assistant_coach: c.assistantCoach ?? null, room: c.room ?? null, notes: c.notes ?? null, objectives: c.objectives ?? null, worksheet_url: c.worksheetUrl ?? null };
  await tx`INSERT INTO teaching_documents ${tx(fields)} ON CONFLICT (record_id) DO UPDATE SET workflow_version = EXCLUDED.workflow_version, syllabus_id = EXCLUDED.syllabus_id, meeting_number = EXCLUDED.meeting_number, main_coach = EXCLUDED.main_coach, assistant_coach = EXCLUDED.assistant_coach, room = EXCLUDED.room, notes = EXCLUDED.notes, objectives = EXCLUDED.objectives, worksheet_url = EXCLUDED.worksheet_url`;
  if (record.kind === 'syllabus') {
    const syllabus = { record_id: record.id, academic_year: c.academicYear ?? null, semester: c.semester ?? null, deadline: c.deadline || null, description: c.description ?? null, learning_values: c.values ?? null, projects: c.projects ?? null, project_description: c.projectDescription ?? null, outline: c.outline ?? null };
    await tx`INSERT INTO teaching_syllabuses ${tx(syllabus)} ON CONFLICT (record_id) DO UPDATE SET academic_year = EXCLUDED.academic_year, semester = EXCLUDED.semester, deadline = EXCLUDED.deadline, description = EXCLUDED.description, learning_values = EXCLUDED.learning_values, projects = EXCLUDED.projects, project_description = EXCLUDED.project_description, outline = EXCLUDED.outline`;
    await tx`DELETE FROM syllabus_meetings WHERE syllabus_id = ${record.id}`;
    const sessions = (c.sessions || []).map((item, index) => ({ syllabus_id: record.id, position: index + 1, meeting_date: item.date, start_time: item.time, topic: item.topic, phase: item.phase }));
    if (sessions.length) await tx`INSERT INTO syllabus_meetings ${tx(sessions)}`;
  } else if (record.kind === 'lesson-plan') {
    const plan = { record_id: record.id, activities: c.activities ?? null, resources: c.resources ?? null, assessment: c.assessment ?? null };
    await tx`INSERT INTO teaching_lesson_plans ${tx(plan)} ON CONFLICT (record_id) DO UPDATE SET activities = EXCLUDED.activities, resources = EXCLUDED.resources, assessment = EXCLUDED.assessment`;
    await tx`DELETE FROM lesson_plan_steps WHERE record_id = ${record.id}`;
    const steps = (c.steps || []).map((item, index) => ({ record_id: record.id, position: index + 1, title: item.title, phase: item.phase, minutes: item.minutes ? Number(item.minutes) : null, purpose: item.purpose, teacher_activity: item.teacherActivity, student_activity: item.studentActivity }));
    if (steps.length) await tx`INSERT INTO lesson_plan_steps ${tx(steps)}`;
  } else if (record.kind === 'meeting') {
    const [meeting] = await tx`INSERT INTO class_meetings (class_group_id, meeting_date) SELECT id, ${record.date}::date FROM class_groups WHERE id = ${record.classId} ON CONFLICT (class_group_id, meeting_date) DO UPDATE SET meeting_date = EXCLUDED.meeting_date RETURNING id`;
    const journal = { record_id: record.id, meeting_id: meeting?.id || null, teacher_attendance: c.teacherAttendance ?? null, reflection: c.reflection ?? null };
    await tx`INSERT INTO teaching_meeting_journals ${tx(journal)} ON CONFLICT (record_id) DO UPDATE SET meeting_id = EXCLUDED.meeting_id, teacher_attendance = EXCLUDED.teacher_attendance, reflection = EXCLUDED.reflection`;
    await tx`DELETE FROM student_meeting_feedback WHERE record_id = ${record.id}`;
    const profiles = c.students?.length ? await tx`SELECT id FROM student_profiles WHERE id IN ${tx(c.students.map((student) => student.id))}` : [];
    const feedback = (c.students || []).map((student, index) => ({ record_id: record.id, student_id: student.id, student_profile_id: profiles.some((profile) => profile.id === student.id) ? student.id : null, student_name: student.name ?? null, position: index, attendance: student.attendance, score: student.score === '' ? null : Number(student.score), feedback: student.feedback, has_ratings: Boolean(student.ratings), affective: student.ratings?.affective ? Number(student.ratings.affective) : null, problem_solving: student.ratings?.problemSolving ? Number(student.ratings.problemSolving) : null, storytelling: student.ratings?.storytelling ? Number(student.ratings.storytelling) : null, performance: student.ratings?.performance ? Number(student.ratings.performance) : null }));
    if (feedback.length) await tx`INSERT INTO student_meeting_feedback ${tx(feedback)}`;
  } else if (record.kind === 'slides') {
    await tx`INSERT INTO teaching_materials (record_id, canva_url) VALUES (${record.id}, ${c.canvaUrl ?? null}) ON CONFLICT (record_id) DO UPDATE SET canva_url = EXCLUDED.canva_url`;
  } else {
    await tx`INSERT INTO class_requests (record_id, items, reason, timing) VALUES (${record.id}, ${c.items ?? null}, ${c.reason ?? null}, ${c.timing ?? null}) ON CONFLICT (record_id) DO UPDATE SET items = EXCLUDED.items, reason = EXCLUDED.reason, timing = EXCLUDED.timing`;
  }
}

export async function migrateTeachingWorkflow(tx: Transaction) {
  const records = await tx<WorkflowRecord[]>`SELECT r.id, r.kind, r.class_id AS "classId", r.meeting_date::text AS date, r.content FROM teaching_records r LEFT JOIN teaching_documents d ON d.record_id = r.id WHERE d.record_id IS NULL ORDER BY CASE WHEN r.kind = 'syllabus' THEN 0 ELSE 1 END, r.updated_at`;
  for (const record of records) await writeTeachingWorkflow(tx, record);
  if (records.length) await tx`UPDATE teaching_files f SET position = source.position FROM (SELECT r.id AS record_id, (entry.item->>'id')::uuid AS file_id, entry.position::int AS position FROM teaching_records r CROSS JOIN LATERAL jsonb_array_elements(r.files) WITH ORDINALITY AS entry(item, position)) source WHERE f.record_id = source.record_id AND f.id = source.file_id AND f.record_id IN ${tx(records.map((record) => record.id))}`;
}

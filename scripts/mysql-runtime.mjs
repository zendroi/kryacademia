import { readFile } from 'node:fs/promises';
import { inspectMySQL } from '../lib/mysql-connection.mjs';

const nullable = (expression) => `JSON_MERGE_PATCH(JSON_OBJECT(), ${expression})`;

export async function prepareMySQLRuntime(connection) {
  const { engine } = await inspectMySQL(connection);
  const ordered = (expression, table, alias, owner, order) => engine === 'mariadb'
    ? `JSON_EXTRACT(COALESCE((SELECT JSON_ARRAYAGG(${expression} ORDER BY ${order}) FROM ${table} ${alias} WHERE ${owner} = r.id), JSON_ARRAY()), '$')`
    : `COALESCE((SELECT JSON_ARRAYAGG(${expression}) OVER (ORDER BY ${order} ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM ${table} ${alias} WHERE ${owner} = r.id LIMIT 1), JSON_ARRAY())`;
  await connection.query('CREATE TABLE IF NOT EXISTS portal_locks (id CHAR(64) PRIMARY KEY) ENGINE=InnoDB');
  // Match PostgreSQL insertion defaults, including columns retained only for historical data.
  const defaults = {
    portal_users: { display_name: "('')", review_note: "('')", ktp_number: "('')", bank_name: "('')", bank_account: "('')", phone: "('')", temp_password: "('')" },
    portal_account_events: { note: "('')" }, academy_core_state: { catalog_hash: "('')" },
    class_groups: { canva_url: "('')", target_meetings: '0' }, class_meetings: { canva_url: "('')", worksheet_url: "('')" },
    teaching_records: { content: '(JSON_OBJECT())', files: '(JSON_ARRAY())', reviewer_note: "('')" },
    academy_events: { before_data: '(JSON_OBJECT())' }, teaching_events: { before_data: '(JSON_OBJECT())' },
    notification_jobs: { last_error: "('')" }, inquiries: { details: '(JSON_OBJECT())' },
  };
  for (const [table, columns] of Object.entries(defaults)) {
    for (const [column, value] of Object.entries(columns)) {
      const type = column === 'target_meetings' ? 'INT' : value.includes('JSON_') ? 'JSON' : 'TEXT';
      await connection.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${type} NOT NULL DEFAULT ${value}`);
    }
  }
  const sessions = ordered("JSON_OBJECT('date', CAST(sm.meeting_date AS CHAR), 'time', TIME_FORMAT(sm.start_time, '%H:%i'), 'topic', sm.topic, 'phase', sm.phase)", 'syllabus_meetings', 'sm', 'sm.syllabus_id', 'sm.position');
  const steps = ordered("JSON_OBJECT('title', ls.title, 'phase', ls.phase, 'minutes', COALESCE(CAST(ls.minutes AS CHAR), ''), 'purpose', ls.purpose, 'teacherActivity', ls.teacher_activity, 'studentActivity', ls.student_activity)", 'lesson_plan_steps', 'ls', 'ls.record_id', 'ls.position');
  const students = ordered(nullable("JSON_OBJECT('id', sf.student_id, 'name', sf.student_name, 'attendance', sf.attendance, 'score', COALESCE(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(CAST(sf.score AS DECIMAL(5,2)) AS CHAR))), ''), 'feedback', sf.feedback, 'ratings', CASE WHEN sf.has_ratings THEN JSON_OBJECT('affective', COALESCE(CAST(sf.affective AS CHAR), ''), 'problemSolving', COALESCE(CAST(sf.problem_solving AS CHAR), ''), 'storytelling', COALESCE(CAST(sf.storytelling AS CHAR), ''), 'performance', COALESCE(CAST(sf.performance AS CHAR), '')) END)"), 'student_meeting_feedback', 'sf', 'sf.record_id', 'sf.position');
  const requests = ordered("JSON_OBJECT('id', qi.id, 'name', qi.name, 'quantity', qi.quantity, 'adminNote', qi.admin_note)", 'class_request_items', 'qi', 'qi.record_id', 'qi.position');
  const files = ordered("JSON_OBJECT('id', f.id, 'name', f.name, 'mime', f.mime, 'size', COALESCE(f.size, OCTET_LENGTH(f.bytes)))", 'teaching_files', 'f', 'f.record_id', 'f.position, f.id');
  await connection.query(`CREATE OR REPLACE VIEW teaching_record_details AS
    SELECT r.id, r.teacher_email, r.kind, r.class_id, r.meeting_date, r.title, r.status, r.reviewer_note, r.updated_at,
    JSON_MERGE_PATCH(JSON_OBJECT(), JSON_OBJECT(
      'workflowVersion', d.workflow_version, 'syllabusId', d.syllabus_id, 'meetingNumber', d.meeting_number,
      'mainCoach', d.main_coach, 'assistantCoach', d.assistant_coach, 'room', d.room, 'notes', d.notes,
      'objectives', d.objectives, 'worksheetUrl', d.worksheet_url,
      'academicYear', s.academic_year, 'semester', s.semester, 'deadline', CAST(s.deadline AS CHAR),
      'description', s.description, 'values', s.learning_values, 'projects', s.projects, 'projectDescription', s.project_description, 'outline', s.outline,
      'activities', l.activities, 'resources', l.resources, 'assessment', l.assessment,
      'teacherAttendance', j.teacher_attendance, 'reflection', j.reflection,
      'canvaUrl', m.canva_url, 'items', q.items, 'reason', q.reason, 'timing', q.timing),
      CASE WHEN r.kind = 'syllabus' AND (d.workflow_version = 2 OR EXISTS (SELECT 1 FROM syllabus_meetings sm WHERE sm.syllabus_id = r.id)) THEN JSON_OBJECT('sessions', ${sessions}) ELSE JSON_OBJECT() END,
      CASE WHEN r.kind = 'lesson-plan' AND (d.workflow_version = 2 OR EXISTS (SELECT 1 FROM lesson_plan_steps ls WHERE ls.record_id = r.id)) THEN JSON_OBJECT('steps', ${steps}) ELSE JSON_OBJECT() END,
      CASE WHEN r.kind = 'meeting' THEN JSON_OBJECT('students', ${students}) ELSE JSON_OBJECT() END,
      CASE WHEN r.kind = 'request' AND EXISTS (SELECT 1 FROM class_request_items qi WHERE qi.record_id = r.id) THEN JSON_OBJECT('requestLines', ${requests}) ELSE JSON_OBJECT() END
    ) AS content, ${files} AS files, r.revision
    FROM teaching_records r JOIN teaching_documents d ON d.record_id = r.id
    LEFT JOIN teaching_syllabuses s ON s.record_id = r.id LEFT JOIN teaching_lesson_plans l ON l.record_id = r.id
    LEFT JOIN teaching_meeting_journals j ON j.record_id = r.id LEFT JOIN teaching_materials m ON m.record_id = r.id LEFT JOIN class_requests q ON q.record_id = r.id`);
  // This view uses portable SQL; keep the established access/deadline predicate in one place.
  const phase5 = await readFile(new URL('../database/phase5.sql', import.meta.url), 'utf8');
  const view = phase5.slice(phase5.indexOf('CREATE OR REPLACE VIEW notification_deadline_tasks'));
  if (!view.startsWith('CREATE OR REPLACE VIEW notification_deadline_tasks')) throw new Error('Deadline view definition is missing.');
  await connection.query(view);
  return { runtimePrepared: true };
}

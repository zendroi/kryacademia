import { randomUUID } from 'node:crypto';
import { clause, isMySQL, lockScope, textColumn } from './sql-dialect.mjs';

export async function notifyTeacher(tx, { key, teacherEmail, recordId, title, message }) {
  const id = randomUUID();
  if (isMySQL(tx)) {
    await lockScope(tx, `notification:${key}`);
    if ((await tx`SELECT id FROM notification_jobs WHERE dedupe_key = ${key}`).length) return;
    await tx`INSERT INTO notification_jobs (id, dedupe_key, teacher_email, record_id, title, message, status, attempts, delivered_at) VALUES (${id}, ${key}, ${teacherEmail}, ${recordId}, ${title}, ${message}, 'delivered', 1, CURRENT_TIMESTAMP(6))`;
    await tx`INSERT INTO teacher_notifications (id, teacher_email, record_id, title, message, source_job_id) VALUES (${randomUUID()}, ${teacherEmail}, ${recordId}, ${title}, ${message}, ${id})`;
    return;
  }
  const [job] = await tx`INSERT INTO notification_jobs (id, dedupe_key, teacher_email, record_id, title, message, status, attempts, delivered_at)
    VALUES (${id}, ${key}, ${teacherEmail}, ${recordId}, ${title}, ${message}, 'delivered', 1, CURRENT_TIMESTAMP(6))
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`;
  if (job) await tx`INSERT INTO teacher_notifications (id, teacher_email, record_id, title, message, source_job_id)
    VALUES (${randomUUID()}, ${teacherEmail}, ${recordId}, ${title}, ${message}, ${job.id})`;
}

export async function planDeadlineReminders(sql) {
  const tasks = isMySQL(sql) ? await sql`
    SELECT t.*, CASE WHEN due_date < DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) THEN 'overdue'
      WHEN DATEDIFF(due_date, DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR)) = 3 THEN 'h3' ELSE 'h1' END AS stage
    FROM notification_deadline_tasks t
    WHERE (due_date < DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) OR DATEDIFF(due_date, DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR)) IN (1,3))
      AND NOT EXISTS (SELECT 1 FROM notification_jobs j WHERE j.teacher_email = t.teacher_email AND j.deadline_id = t.deadline_id AND j.due_date = t.due_date
        AND j.stage = CASE WHEN t.due_date < DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) THEN 'overdue' WHEN DATEDIFF(t.due_date, DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR))=3 THEN 'h3' ELSE 'h1' END AND j.status != 'cancelled')
    ORDER BY due_date, teacher_email, deadline_id LIMIT 100
  ` : await sql`
    WITH candidates AS (
      SELECT t.*, CASE WHEN due_date < (CURRENT_TIMESTAMP(6) AT TIME ZONE 'Asia/Jakarta')::date THEN 'overdue'
        WHEN due_date - (CURRENT_TIMESTAMP(6) AT TIME ZONE 'Asia/Jakarta')::date = 3 THEN 'h3' ELSE 'h1' END AS stage
      FROM notification_deadline_tasks t
      WHERE due_date < (CURRENT_TIMESTAMP(6) AT TIME ZONE 'Asia/Jakarta')::date
        OR due_date - (CURRENT_TIMESTAMP(6) AT TIME ZONE 'Asia/Jakarta')::date IN (1, 3)
    ), planned AS (
      SELECT c.*, 'deadline:' || jsonb_build_array(teacher_email, deadline_id, due_date::text, stage)::text AS dedupe_key FROM candidates c
    )
    SELECT p.teacher_email, p.deadline_id, p.class_id, p.record_id, p.klass, p.kind, p.request_timing,
      p.meeting_date::text, p.due_date::text, p.stage, p.dedupe_key
    FROM planned p WHERE NOT EXISTS (SELECT 1 FROM notification_jobs j WHERE j.dedupe_key = p.dedupe_key AND j.status != 'cancelled')
    ORDER BY p.due_date, p.teacher_email, p.deadline_id LIMIT 100
  `;
  if (!tasks.length) return 0;
  const rows = tasks.map((task) => {
    const label = task.kind === 'request' ? task.request_timing === 'Before semester' ? 'Semester class needs' : 'Class needs'
      : { syllabus: 'Syllabus', 'lesson-plan': 'Lesson plan', meeting: 'Feedback & attendance' }[task.kind];
    return { id: randomUUID(), dedupe_key: task.dedupe_key || `deadline:[${[task.teacher_email, task.deadline_id, task.due_date, task.stage].map((value) => JSON.stringify(value)).join(', ')}]`, teacher_email: task.teacher_email, record_id: task.record_id,
      class_id: task.class_id, deadline_id: task.deadline_id, due_date: task.due_date, stage: task.stage,
      title: `${task.stage === 'overdue' ? 'Overdue' : 'Upcoming deadline'}: ${label}`,
      message: `${label} for ${task.klass} (${task.meeting_date}) is due ${task.due_date}. Please complete it in your teaching workspace.` };
  });
  if (isMySQL(sql)) {
    let queued = 0;
    for (const row of rows) queued += await sql.begin(async (tx) => {
      await lockScope(tx, `notification:${row.dedupe_key}`);
      const [existing] = await tx`SELECT id, status FROM notification_jobs WHERE dedupe_key = ${row.dedupe_key} FOR UPDATE`;
      if (existing && existing.status !== 'cancelled') return 0;
      if (existing) await tx`UPDATE notification_jobs SET status = 'pending', attempts = 0, available_at = CURRENT_TIMESTAMP(6), last_error = '', title = ${row.title}, message = ${row.message} WHERE id = ${existing.id}`;
      else await tx`INSERT INTO notification_jobs ${tx(row)}`;
      return 1;
    });
    return queued;
  }
  return (await sql`INSERT INTO notification_jobs ${sql(rows)} ON CONFLICT (dedupe_key) DO UPDATE
    SET status = 'pending', attempts = 0, available_at = CURRENT_TIMESTAMP(6), last_error = '', title = EXCLUDED.title, message = EXCLUDED.message
    WHERE notification_jobs.status = 'cancelled' RETURNING id`).length;
}

export async function runNotificationJobs(sql, limit = 100) {
  // shortcut: at most 100 jobs/40 seconds per invocation; run more often before scaling beyond the pilot.
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Job batch must contain 1 to 100 jobs.');
  await sql`DELETE FROM portal_sessions WHERE expires_at <= CURRENT_TIMESTAMP(6)`;
  const until = Date.now() + 40000;
  const result = { queued: await planDeadlineReminders(sql), delivered: 0, cancelled: 0, retried: 0, failed: 0 };
  for (let i = 0; i < limit && Date.now() < until; i++) {
    const outcome = await sql.begin(async (tx) => {
      const [job] = await tx`SELECT *, ${textColumn(tx, 'due_date')} AS due FROM notification_jobs
        WHERE status = 'pending' AND available_at <= CURRENT_TIMESTAMP(6) AND attempts < 5
        ORDER BY available_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!job) return null;
      await tx`UPDATE notification_jobs SET attempts = attempts + 1 WHERE id = ${job.id}`;
      try {
        // Dashboard-only delivery stays atomic; use leases/provider idempotency before adding external senders.
        return await tx.savepoint(async (sp) => {
          await sp`SELECT id FROM academy_core_state WHERE id = 1 ${clause(sp, 'FOR SHARE', 'LOCK IN SHARE MODE')}`;
          await sp`SELECT email FROM portal_users WHERE email = ${job.teacher_email} ${clause(sp, 'FOR NO KEY UPDATE', 'FOR UPDATE')}`;
          const [task] = await sp`SELECT t.*, ${clause(sp, "t.due_date - (CURRENT_TIMESTAMP(6) AT TIME ZONE 'Asia/Jakarta')::date", 'DATEDIFF(t.due_date, DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR))')} AS days_remaining
            FROM notification_deadline_tasks t WHERE t.teacher_email = ${job.teacher_email}
              AND t.deadline_id = ${job.deadline_id} AND t.due_date = CAST(${job.due} AS DATE)`;
          if (!task || !(job.stage === 'overdue' ? Number(task.days_remaining) < 0 : Number(task.days_remaining) === (job.stage === 'h3' ? 3 : 1))) {
            await sp`UPDATE notification_jobs SET status = 'cancelled', last_error = 'Deadline, assignment or submission changed.' WHERE id = ${job.id}`;
            return 'cancelled';
          }
          if (task.record_id) {
            const [record] = await sp`SELECT status FROM teaching_records WHERE id = ${task.record_id} ${clause(sp, 'FOR SHARE', 'LOCK IN SHARE MODE')}`;
            if (!record || ['Submitted', 'Approved', 'Fulfilled'].includes(record.status)) {
              await sp`UPDATE notification_jobs SET status = 'cancelled', last_error = 'Submission completed.' WHERE id = ${job.id}`;
              return 'cancelled';
            }
          }
          await sp`INSERT INTO teacher_notifications (id, teacher_email, record_id, title, message, source_job_id)
            VALUES (${randomUUID()}, ${job.teacher_email}, ${task.record_id}, ${job.title}, ${job.message}, ${job.id})
            ${clause(sp, 'ON CONFLICT (source_job_id) WHERE source_job_id IS NOT NULL DO NOTHING', 'ON DUPLICATE KEY UPDATE source_job_id = source_job_id')}`;
          await sp`UPDATE notification_jobs SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP(6), last_error = '' WHERE id = ${job.id}`;
          return 'delivered';
        });
      } catch (error) {
        console.error('Notification delivery failed', error.code || 'Application error');
        const status = job.attempts + 1 >= 5 ? 'failed' : 'pending';
        await tx`UPDATE notification_jobs SET status = ${status}, available_at = CURRENT_TIMESTAMP(6) + ${isMySQL(tx) ? tx`INTERVAL ${2 ** job.attempts} MINUTE` : tx`${2 ** job.attempts} * INTERVAL '1 minute'`},
          last_error = ${status === 'failed' ? 'Dashboard delivery failed; manual retry required.' : 'Dashboard delivery failed; retry scheduled.'} WHERE id = ${job.id}`;
        return status === 'failed' ? 'failed' : 'retried';
      }
    });
    if (!outcome) break;
    result[outcome]++;
  }
  const [{ count }] = await sql`SELECT count(*) AS count FROM notification_jobs WHERE status = 'pending' AND available_at <= CURRENT_TIMESTAMP(6)`;
  return { ...result, remaining: Number(count) };
}

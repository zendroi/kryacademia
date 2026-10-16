import { randomUUID } from 'node:crypto';

export async function notifyTeacher(tx, { key, teacherEmail, recordId, title, message }) {
  const id = randomUUID();
  const [job] = await tx`INSERT INTO notification_jobs (id, dedupe_key, teacher_email, record_id, title, message, status, attempts, delivered_at)
    VALUES (${id}, ${key}, ${teacherEmail}, ${recordId}, ${title}, ${message}, 'delivered', 1, NOW())
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`;
  if (job) await tx`INSERT INTO teacher_notifications (id, teacher_email, record_id, title, message, source_job_id)
    VALUES (${randomUUID()}, ${teacherEmail}, ${recordId}, ${title}, ${message}, ${job.id})`;
}

export async function planDeadlineReminders(sql) {
  const tasks = await sql`
    WITH candidates AS (
      SELECT t.*, CASE WHEN due_date < (NOW() AT TIME ZONE 'Asia/Jakarta')::date THEN 'overdue'
        WHEN due_date - (NOW() AT TIME ZONE 'Asia/Jakarta')::date = 3 THEN 'h3' ELSE 'h1' END AS stage
      FROM notification_deadline_tasks t
      WHERE due_date < (NOW() AT TIME ZONE 'Asia/Jakarta')::date
        OR due_date - (NOW() AT TIME ZONE 'Asia/Jakarta')::date IN (1, 3)
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
    return { id: randomUUID(), dedupe_key: task.dedupe_key, teacher_email: task.teacher_email, record_id: task.record_id,
      class_id: task.class_id, deadline_id: task.deadline_id, due_date: task.due_date, stage: task.stage,
      title: `${task.stage === 'overdue' ? 'Overdue' : 'Upcoming deadline'}: ${label}`,
      message: `${label} for ${task.klass} (${task.meeting_date}) is due ${task.due_date}. Please complete it in your teaching workspace.` };
  });
  return (await sql`INSERT INTO notification_jobs ${sql(rows)} ON CONFLICT (dedupe_key) DO UPDATE
    SET status = 'pending', attempts = 0, available_at = NOW(), last_error = '', title = EXCLUDED.title, message = EXCLUDED.message
    WHERE notification_jobs.status = 'cancelled' RETURNING id`).length;
}

export async function runNotificationJobs(sql, limit = 100) {
  // shortcut: at most 100 jobs/40 seconds per invocation; run more often before scaling beyond the pilot.
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Job batch must contain 1 to 100 jobs.');
  const until = Date.now() + 40000;
  const result = { queued: await planDeadlineReminders(sql), delivered: 0, cancelled: 0, retried: 0, failed: 0 };
  for (let i = 0; i < limit && Date.now() < until; i++) {
    const outcome = await sql.begin(async (tx) => {
      const [job] = await tx`SELECT *, due_date::text AS due FROM notification_jobs
        WHERE status = 'pending' AND available_at <= NOW() AND attempts < 5
        ORDER BY available_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!job) return null;
      await tx`UPDATE notification_jobs SET attempts = attempts + 1 WHERE id = ${job.id}`;
      try {
        // Dashboard-only delivery stays atomic; use leases/provider idempotency before adding external senders.
        return await tx.savepoint(async (sp) => {
          await sp`SELECT id FROM academy_core_state WHERE id = 1 FOR SHARE`;
          await sp`SELECT email FROM portal_users WHERE email = ${job.teacher_email} FOR NO KEY UPDATE`;
          const [task] = await sp`SELECT t.*, t.due_date - (NOW() AT TIME ZONE 'Asia/Jakarta')::date AS days_remaining
            FROM notification_deadline_tasks t WHERE t.teacher_email = ${job.teacher_email}
              AND t.deadline_id = ${job.deadline_id} AND t.due_date = ${job.due}::date`;
          if (!task || !(job.stage === 'overdue' ? task.days_remaining < 0 : task.days_remaining === (job.stage === 'h3' ? 3 : 1))) {
            await sp`UPDATE notification_jobs SET status = 'cancelled', last_error = 'Deadline, assignment or submission changed.' WHERE id = ${job.id}`;
            return 'cancelled';
          }
          if (task.record_id) {
            const [record] = await sp`SELECT status FROM teaching_records WHERE id = ${task.record_id} FOR SHARE`;
            if (!record || ['Submitted', 'Approved', 'Fulfilled'].includes(record.status)) {
              await sp`UPDATE notification_jobs SET status = 'cancelled', last_error = 'Submission completed.' WHERE id = ${job.id}`;
              return 'cancelled';
            }
          }
          await sp`INSERT INTO teacher_notifications (id, teacher_email, record_id, title, message, source_job_id)
            VALUES (${randomUUID()}, ${job.teacher_email}, ${task.record_id}, ${job.title}, ${job.message}, ${job.id})
            ON CONFLICT (source_job_id) WHERE source_job_id IS NOT NULL DO NOTHING`;
          await sp`UPDATE notification_jobs SET status = 'delivered', delivered_at = NOW(), last_error = '' WHERE id = ${job.id}`;
          return 'delivered';
        });
      } catch {
        const status = job.attempts + 1 >= 5 ? 'failed' : 'pending';
        await tx`UPDATE notification_jobs SET status = ${status}, available_at = NOW() + ${2 ** job.attempts} * INTERVAL '1 minute',
          last_error = ${status === 'failed' ? 'Dashboard delivery failed; manual retry required.' : 'Dashboard delivery failed; retry scheduled.'} WHERE id = ${job.id}`;
        return status === 'failed' ? 'failed' : 'retried';
      }
    });
    if (!outcome) break;
    result[outcome]++;
  }
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM notification_jobs WHERE status = 'pending' AND available_at <= NOW()`;
  return { ...result, remaining: count };
}

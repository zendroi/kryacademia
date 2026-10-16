import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { core, workflow } from './academic-fixture.mjs';

if (!process.env.PORTAL_TEST_SCHEMA?.startsWith('security_check_')) throw new Error('Use the isolated security runner');
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'verify-full', max: 1 });
const rollback = new Error('Phase 3 fixture rollback');
try {
  await sql.begin(async (tx) => {
    const [archive] = await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`;
    const before = await core.readAcademicCore(tx);
    const next = structuredClone(before);
    const klass = next.klasses[0];
    const assignments = await tx`SELECT coach_id, assigned_at FROM coach_assignments WHERE class_group_id = ${klass.id} ORDER BY coach_id`;
    klass.schedule = 'Relational schedule'; klass.revision++;
    klass.deadlines.meetings.push({ date: '2033-02-20', lessonPlan: '', feedback: '' });
    await core.writeAcademicCore(tx, next, before);
    const reloaded = await core.readAcademicCore(tx);
    assert.equal(reloaded.klasses[0].schedule, 'Relational schedule');
    assert.ok(reloaded.klasses[0].deadlines.meetings.some((meeting) => meeting.date === '2033-02-20'), 'Meeting dates without deadlines must survive');
    assert.deepEqual(await tx`SELECT coach_id, assigned_at FROM coach_assignments WHERE class_group_id = ${klass.id} ORDER BY coach_id`, assignments, 'Schedule changes must preserve assignment dates');
    assert.equal((await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, archive.hash, 'Catalog writes must leave the archive untouched');
    await core.initializeAcademicCore(tx);
    assert.equal((await core.readAcademicCore(tx)).klasses[0].schedule, 'Relational schedule', 'Re-running bootstrap must not overwrite relational changes');
    const teacher = 'teacher@krya.global';
    const ids = Object.fromEntries(['syllabus', 'lesson-plan', 'meeting', 'slides', 'request'].map((kind) => [kind, randomUUID()]));
    const contents = {
      syllabus: { workflowVersion: 2, academicYear: '2033-2034', semester: '1', deadline: '2033-02-12', mainCoach: 'Coach', description: 'Explore science', objectives: 'Investigate', values: 'Care', projects: 'Prototype', projectDescription: 'Build and test', sessions: [{ date: '2033-02-20', time: '08:30', topic: 'Investigation', phase: 'Inspiring' }] },
      'lesson-plan': { workflowVersion: 2, syllabusId: ids.syllabus, meetingNumber: 1, mainCoach: 'Coach', objectives: 'Observe', resources: 'Tools', assessment: 'Reflection', steps: [{ title: 'Explore', phase: 'Inspiring', minutes: '30', purpose: 'Observe', teacherActivity: 'Guide', studentActivity: 'Investigate' }] },
      meeting: { workflowVersion: 2, syllabusId: ids.syllabus, meetingNumber: 1, mainCoach: 'Coach', teacherAttendance: 'Present', reflection: 'Collaborative learning', students: [{ id: before.students[0].id, name: 'Historical learner', attendance: 'Present', score: '80', feedback: 'Careful observation', ratings: { affective: '3', problemSolving: '4', storytelling: '', performance: '3' } }] },
      slides: { workflowVersion: 2, syllabusId: ids.syllabus, meetingNumber: 1, mainCoach: 'Coach', canvaUrl: 'https://canva.link/example', worksheetUrl: 'https://canva.link/worksheet', notes: 'Review material' },
      request: { workflowVersion: 2, syllabusId: ids.syllabus, timing: 'Before semester', items: '3 microscopes', reason: 'Observation' },
    };
    for (const [kind, content] of Object.entries(contents)) {
      const id = ids[kind];
      await tx`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status) VALUES (${id}, ${teacher}, ${kind}, ${klass.id}, '2033-02-20', ${kind}, ${tx.json(content)}, 'Draft')`;
    }
    const file = randomUUID();
    await tx`INSERT INTO teaching_files (id, record_id, name, mime, bytes) VALUES (${file}, ${ids.meeting}, 'proof.webp', 'image/webp', ${Buffer.from('fixture-bytes')})`;
    await tx`UPDATE teaching_records SET files = ${tx.json([{ id: file, name: 'proof.webp', mime: 'image/webp', size: 13 }])} WHERE id = ${ids.meeting}`;
    await workflow.migrateTeachingWorkflow(tx);
    for (const [kind, content] of Object.entries(contents)) assert.deepEqual((await tx`SELECT content FROM teaching_record_details WHERE id = ${ids[kind]}`)[0].content, content, `Historical ${kind} changed`);
    const journal = { id: ids.meeting, kind: 'meeting', classId: klass.id, date: '2033-02-20', content: { ...contents.meeting, reflection: 'Updated relational feedback' } };
    await workflow.writeTeachingWorkflow(tx, journal);
    assert.equal((await tx`SELECT content FROM teaching_records WHERE id = ${ids.meeting}`)[0].content.reflection, 'Collaborative learning', 'Original workflow JSON must stay archived');
    assert.equal((await tx`SELECT content FROM teaching_record_details WHERE id = ${ids.meeting}`)[0].content.reflection, 'Updated relational feedback');
    await tx`UPDATE teaching_files SET position = 0 WHERE id = ${file}`;
    await workflow.migrateTeachingWorkflow(tx);
    assert.equal((await tx`SELECT content FROM teaching_record_details WHERE id = ${ids.meeting}`)[0].content.reflection, 'Updated relational feedback', 'Migration must not overwrite edited feedback');
    assert.equal((await tx`SELECT position FROM teaching_files WHERE id = ${file}`)[0].position, 0, 'Re-running migration must preserve edited file ordering');
    assert.equal((await tx`SELECT files FROM teaching_record_details WHERE id = ${ids.meeting}`)[0].files[0].size, 13, 'File size must come from stored bytes');
    await tx`UPDATE enrollments SET status = 'withdrawn' WHERE student_id = ${before.students[0].id}`;
    assert.equal((await tx`SELECT content FROM teaching_record_details WHERE id = ${ids.meeting}`)[0].content.students[0].name, 'Historical learner');
    await assert.rejects(tx.savepoint((sp) => sp`UPDATE student_meeting_feedback SET affective = 5 WHERE record_id = ${ids.meeting}`), /check constraint/);
    await assert.rejects(tx.savepoint(async (sp) => {
      await sp`DELETE FROM teaching_records WHERE id = ${ids.syllabus}`;
      await sp`SET CONSTRAINTS teaching_documents_syllabus_id_fkey IMMEDIATE`;
    }), /foreign key constraint/);
    await tx`DELETE FROM teaching_records WHERE id IN ${tx(Object.values(ids))}`;
    await tx`SET CONSTRAINTS ALL IMMEDIATE`;
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await sql.end(); }
console.log('Phase 3 archive preservation, workflow migration, relational edits, constraints and historical snapshots passed.');

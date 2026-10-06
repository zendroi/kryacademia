'use client';

import Image from 'next/image';
import { ArrowUpRight, FileText, Plus, Trash2 } from 'lucide-react';
import AnimatedInput from '@/components/smoothui/animated-input';
import BasicDropdown from '@/components/smoothui/basic-dropdown';
import { assignedMaterials, canvaTemplates, dateLabel, emptySteps, learningPhases, lessonPhases, rubricAspects, rubricDescriptions, rubricLevels, sourceSyllabus, type LessonStep, type Ratings, type RecordDraft, type TeachingContent, type TeachingFile, type TeachingRecord } from './teacherData';
import type { KlassRecord, StudentRecord } from '../admin/adminData';

export function TeacherSelect({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="admin-select teacher-select"><span>{label}</span><BasicDropdown key={value} label={`${label}: ${options.find((option) => option.id === value)?.label || value}`} items={options} onChange={(item) => onChange(String(item.id))} /></div>;
}

export function TeachingAttachments({ files }: { files: TeachingFile[] }) {
  return <div className="teacher-attachments">{files.map((file) => <a key={file.id} href={`/api/teaching-files/${file.id}`} target="_blank" rel="noopener noreferrer" className={file.mime.startsWith('image/') ? 'teacher-photo-link' : 'teacher-file-link'}>
    {file.mime.startsWith('image/') ? <Image src={`/api/teaching-files/${file.id}`} alt={file.name} width={280} height={200} unoptimized /> : <><FileText size={18} />{file.name}<ArrowUpRight size={15} /></>}
  </a>)}</div>;
}

export function TeacherTextArea({ label, value, onChange, required = false, maxLength = 6000 }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; maxLength?: number }) {
  return <label className="admin-text-field teacher-text-field"><span>{label}{required ? ' *' : ''}</span><textarea rows={3} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function CoachFields({ content, update }: { content: TeachingContent; update: (content: Partial<TeachingContent>) => void }) {
  return <div className="teacher-form-grid teacher-coach-fields"><AnimatedInput className="admin-animated-input" label="Main coach *" value={content.mainCoach || ''} maxLength={140} onChange={(mainCoach) => update({ mainCoach })} /><AnimatedInput className="admin-animated-input" label="Assistant coach" value={content.assistantCoach || ''} maxLength={140} onChange={(assistantCoach) => update({ assistantCoach })} /></div>;
}

export function RubricGuide() {
  return <details className="teacher-rubric-guide"><summary>Evaluation rubric / 1-4</summary>{Object.entries(rubricAspects).map(([key, label]) => <section key={key}><h4>{label}</h4><ol>{rubricDescriptions[key as keyof Ratings].map((description, index) => <li key={description}><strong>{rubricLevels[index]}</strong><span>{description}</span></li>)}</ol></section>)}</details>;
}

export function StudentRubric({ id, ratings, onChange }: { id: string; ratings?: Ratings; onChange: (ratings: Ratings) => void }) {
  return <div className="teacher-ratings">{Object.entries(rubricAspects).map(([key, label]) => <div key={key}><span>{label}</span><div role="group" aria-label={`${label} ${id}`}>{rubricLevels.map((level, index) => <button key={level} title={`${level}: ${rubricDescriptions[key as keyof Ratings][index]}`} aria-label={`${index + 1} / ${level}`} aria-pressed={ratings?.[key as keyof Ratings] === String(index + 1)} className={ratings?.[key as keyof Ratings] === String(index + 1) ? 'is-active' : ''} type="button" onClick={() => onChange({ affective: '', problemSolving: '', storytelling: '', performance: '', ...ratings, [key]: String(index + 1) })}>{index + 1}</button>)}</div></div>)}</div>;
}

export function SyllabusFields({ draft, patch, deadlines }: { draft: RecordDraft; patch: (draft: Partial<RecordDraft>) => void; deadlines?: KlassRecord['deadlines'] }) {
  const content = draft.content;
  const sessions = content.sessions || [];
  const update = (value: Partial<TeachingContent>) => patch({ content: { ...content, ...value, workflowVersion: 2 } });
  function importSource() {
    const source = sourceSyllabus(draft.classId);
    if (!source || ((content.description || content.objectives) && !window.confirm('Replace the syllabus fields with the supplied 2026-2027 example?'))) return;
    const date = deadlines?.semesterStart || draft.date;
    const offset = Date.parse(date) - Date.parse(source.sessions![0].date);
    patch({ date, title: `${draft.classId === 'coding' ? 'Coding' : 'Biotechnology'} / ${date.slice(0, 4)} / Semester 1`, content: { ...source, academicYear: `${date.slice(0, 4)} - ${Number(date.slice(0, 4)) + 1}`, deadline: deadlines?.syllabus || '', sessions: source.sessions!.map((session) => ({ ...session, date: new Date(Date.parse(session.date) + offset).toISOString().slice(0, 10) })) } });
  }
  function changeSession(index: number, value: Partial<typeof sessions[number]>) { update({ sessions: sessions.map((session, i) => i === index ? { ...session, ...value } : session) }); }
  return <>
    {!draft.id && sourceSyllabus(draft.classId) && <button type="button" className="admin-secondary-action teacher-source-button" onClick={importSource}><FileText size={16} />Use supplied 2026-2027 syllabus</button>}
    <div className="teacher-form-grid"><AnimatedInput className="admin-animated-input" label="Academic year *" value={content.academicYear || ''} maxLength={40} onChange={(academicYear) => update({ academicYear })} /><TeacherSelect label="Semester" value={content.semester || '1'} options={['1', '2'].map((id) => ({ id, label: id }))} onChange={(semester) => update({ semester })} /></div>
    <label className="teacher-date-field teacher-deadline-input"><span>Submission deadline / set by admin</span><input aria-label="Submission deadline" type="date" readOnly value={(draft.date === deadlines?.semesterStart ? deadlines.syllabus : content.deadline) || ''} /></label>
    <CoachFields content={content} update={update} />
    <AnimatedInput className="admin-animated-input" label="Classroom / location" value={content.room || ''} maxLength={140} onChange={(room) => update({ room })} />
    <TeacherTextArea label="Program description" value={content.description || ''} required onChange={(description) => update({ description })} />
    <TeacherTextArea label="Semester learning objectives" value={content.objectives || ''} required onChange={(objectives) => update({ objectives })} />
    <TeacherTextArea label="Values" value={content.values || ''} onChange={(values) => update({ values })} />
    <TeacherTextArea label="Projects" value={content.projects || ''} required onChange={(projects) => update({ projects })} />
    <TeacherTextArea label="Project description" value={content.projectDescription || ''} required onChange={(projectDescription) => update({ projectDescription })} />
    {content.outline && <TeacherTextArea label="Previous syllabus outline" value={content.outline} onChange={(outline) => update({ outline })} />}
    <section className="teacher-syllabus-timeline"><header className="teacher-section-head"><h3>Meeting timeline</h3><button type="button" className="admin-icon-button" title="Add meeting" aria-label="Add meeting" disabled={sessions.length >= 36} onClick={() => {
      const date = sessions.length ? new Date(new Date(`${sessions.at(-1)!.date}T12:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10) : draft.date;
      update({ sessions: [...sessions, { date, time: '08:00', topic: '', phase: 'Creating' }] });
    }}><Plus size={18} /></button></header>{sessions.map((session, index) => <div className="teacher-timeline-entry" key={index}>
      <header><strong>Meeting {index + 1}</strong><button type="button" className="admin-icon-button" title={`Remove meeting ${index + 1}`} aria-label={`Remove meeting ${index + 1}`} onClick={() => update({ sessions: sessions.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></header>
      <div className="teacher-timeline-fields"><label className="teacher-date-field"><span>Date</span><input aria-label={`Meeting ${index + 1} date`} type="date" value={session.date} onChange={(event) => changeSession(index, { date: event.target.value })} /></label><label className="teacher-date-field"><span>Time</span><input aria-label={`Meeting ${index + 1} time`} type="time" value={session.time} onChange={(event) => changeSession(index, { time: event.target.value })} /></label><TeacherSelect label={`Meeting ${index + 1} phase`} value={session.phase} options={learningPhases.map((label) => ({ id: label, label }))} onChange={(phase) => changeSession(index, { phase: phase as typeof session.phase })} /></div>
      <AnimatedInput className="admin-animated-input" label={`Meeting ${index + 1} topic *`} value={session.topic} maxLength={500} onChange={(topic) => changeSession(index, { topic })} />
    </div>)}</section><RubricGuide />
  </>;
}

export function LessonFields({ content, update }: { content: TeachingContent; update: (content: Partial<TeachingContent>) => void }) {
  const steps = content.steps || emptySteps();
  const changeStep = (index: number, value: Partial<LessonStep>) => update({ steps: steps.map((step, i) => i === index ? { ...step, ...value } : step), workflowVersion: 2 });
  return <>
    <TeacherTextArea label="Learning objectives" required value={content.objectives || ''} onChange={(objectives) => update({ objectives })} />
    <TeacherTextArea label="Materials & preparation" required value={content.resources || ''} onChange={(resources) => update({ resources })} />
    {content.activities && <TeacherTextArea label="Previous learning activities" value={content.activities} onChange={(activities) => update({ activities })} />}
    <section className="teacher-lesson-steps"><header className="teacher-section-head"><h3>Learning activities</h3><span>{steps.reduce((sum, step) => sum + (Number(step.minutes) || 0), 0)} minutes</span><button type="button" className="admin-icon-button" title="Add activity" aria-label="Add activity" disabled={steps.length >= 12} onClick={() => update({ steps: [...steps, { ...emptySteps()[1], title: '' }] })}><Plus size={18} /></button></header>{steps.map((step, index) => <section className="teacher-lesson-step" key={index}>
      <header><strong>Activity {index + 1}</strong><button type="button" className="admin-icon-button" title={`Remove activity ${index + 1}`} aria-label={`Remove activity ${index + 1}`} disabled={steps.length === 1} onClick={() => update({ steps: steps.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></header>
      <AnimatedInput className="admin-animated-input" label={`Activity ${index + 1} name *`} value={step.title} maxLength={140} onChange={(title) => changeStep(index, { title })} />
      <div className="teacher-form-grid"><TeacherSelect label={`Activity ${index + 1} phase`} value={step.phase} options={lessonPhases.map((label) => ({ id: label, label }))} onChange={(phase) => changeStep(index, { phase: phase as LessonStep['phase'] })} /><label className="teacher-date-field"><span>Duration / minutes *</span><input aria-label={`Activity ${index + 1} minutes`} type="number" min={1} max={240} step={1} value={step.minutes} onChange={(event) => changeStep(index, { minutes: event.target.value })} /></label></div>
      <TeacherTextArea label={`Activity ${index + 1} purpose`} required maxLength={2000} value={step.purpose} onChange={(purpose) => changeStep(index, { purpose })} />
      <div className="teacher-form-grid teacher-activity-columns"><TeacherTextArea label={`Activity ${index + 1} coach activity`} required maxLength={2000} value={step.teacherActivity} onChange={(teacherActivity) => changeStep(index, { teacherActivity })} /><TeacherTextArea label={`Activity ${index + 1} student activity`} required maxLength={2000} value={step.studentActivity} onChange={(studentActivity) => changeStep(index, { studentActivity })} /></div>
    </section>)}</section>
    <TeacherTextArea label="Assessment" required value={content.assessment || ''} onChange={(assessment) => update({ assessment })} />
  </>;
}

export function MaterialFields({ draft, update, canvaTemplate }: { draft: RecordDraft; update: (content: Partial<TeachingContent>) => void; canvaTemplate: string }) {
  const { content } = draft;
  const assigned = content.meetingNumber ? assignedMaterials(draft.classId, content.meetingNumber) : { canvaUrl: '', worksheetUrl: '' };
  return <>
    <div className="teacher-material-links">{assigned.canvaUrl ? <a href={assigned.canvaUrl} target="_blank" rel="noopener noreferrer"><FileText size={18} /><span>Assigned presentation<strong>Meeting {content.meetingNumber}</strong></span><ArrowUpRight size={17} /></a> : <><div className="teacher-canva-templates"><span>KRYAcademia Canva templates</span><div>{[...(canvaTemplate ? [canvaTemplate] : []), ...canvaTemplates].map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer"><FileText size={17} />Template {index + 1}<ArrowUpRight size={15} /></a>)}</div></div><AnimatedInput className="admin-animated-input" label="Your Canva slides link" type="url" value={content.canvaUrl || ''} onChange={(canvaUrl) => update({ canvaUrl })} /></>}
    {assigned.worksheetUrl ? <a href={assigned.worksheetUrl} target="_blank" rel="noopener noreferrer"><FileText size={18} /><span>Assigned worksheet<strong>Meeting {content.meetingNumber}</strong></span><ArrowUpRight size={17} /></a> : <AnimatedInput className="admin-animated-input" label="Worksheet Canva link" type="url" value={content.worksheetUrl || ''} onChange={(worksheetUrl) => update({ worksheetUrl })} />}</div>
    <AnimatedInput className="admin-animated-input" label="Classroom / location" value={content.room || ''} maxLength={140} onChange={(room) => update({ room })} />
    <TeacherTextArea label="Material notes" required value={content.notes || ''} onChange={(notes) => update({ notes })} />
  </>;
}

export function TeachingSummary({ record, students = [] }: { record: TeachingRecord; students?: StudentRecord[] }) {
  const labels = { academicYear: 'Academic year', semester: 'Semester', deadline: 'Submission deadline', meetingNumber: 'Meeting number', mainCoach: 'Main coach', assistantCoach: 'Assistant coach', room: 'Classroom / location', teacherAttendance: 'Teacher attendance', reflection: 'Class feedback', description: 'Program description', objectives: 'Learning objectives', values: 'Values', projects: 'Projects', projectDescription: 'Project description', activities: 'Activities', resources: 'Materials & preparation', outline: 'Previous syllabus outline', assessment: 'Assessment', canvaUrl: 'Presentation', worksheetUrl: 'Worksheet', notes: 'Material notes', items: 'Items & quantities', reason: 'Purpose', timing: 'Request timeframe' };
  return <div className="teacher-summary"><dl className="teacher-review-fields">{Object.entries(labels).map(([key, label]) => { if (key === 'meetingNumber' && record.kind === 'request' && record.content.timing === 'Before semester') return null; const value = record.content[key as keyof typeof labels]; return value ? <div key={key}><dt>{label}</dt><dd>{key === 'canvaUrl' || key === 'worksheetUrl' ? <a href={String(value)} target="_blank" rel="noopener noreferrer">Open {label.toLowerCase()} <ArrowUpRight size={14} /></a> : value}</dd></div> : null; })}</dl>
    {record.content.sessions && <section><h3>Meeting timeline</h3><ol className="teacher-summary-timeline">{record.content.sessions.map((session, index) => <li key={index}><strong>{session.topic}</strong><span>{dateLabel(session.date)} / {session.time} / {session.phase}</span></li>)}</ol><RubricGuide /></section>}
    {record.content.steps?.map((step, index) => <section className="teacher-summary-step" key={index}><h3>{index + 1}. {step.title}</h3><span>{step.phase} / {step.minutes} minutes</span><dl className="teacher-review-fields"><div><dt>Purpose</dt><dd>{step.purpose}</dd></div><div><dt>Coach activity</dt><dd>{step.teacherActivity}</dd></div><div><dt>Student activity</dt><dd>{step.studentActivity}</dd></div></dl></section>)}
    <dl className="teacher-review-fields">{record.content.students?.map((student) => <div key={student.id}><dt>{student.name || students.find((item) => item.id === student.id)?.name || student.id} / {student.attendance}</dt><dd>{student.ratings ? <div className="teacher-summary-ratings">{Object.entries(rubricAspects).map(([key, label]) => <span key={key}>{label}: <strong>{student.ratings?.[key as keyof Ratings] || '-'} / 4</strong></span>)}</div> : `Score: ${student.score || '-'} / 100`}<p>{student.feedback}</p></dd></div>)}</dl>
  </div>;
}

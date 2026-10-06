'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import AnimatedInput from '@/components/smoothui/animated-input';
import Checkbox from '@/components/smoothui/checkbox';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { TeacherSelect } from '../teacher/TeachingControls';
import { approvedSyllabuses, emptyDeadlines, type AcademyCatalog, type CatalogKind, type CatalogRecord } from '@/lib/academy';
import type { TeachingRecord } from '../teacher/teacherData';
import { saveAcademyRecord } from './actions';

const labels = { klasses: 'Klass', institutions: 'institution', coaches: 'coach', students: 'student' };

export default function CatalogEditor({ kind, item, catalog, submissions, onSaved, onPending }: { kind: CatalogKind; item?: CatalogRecord; catalog: AcademyCatalog; submissions: TeachingRecord[]; onSaved: (catalog: AcademyCatalog) => void; onPending: (pending: boolean) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ mode: 'Online', level: 'Coach', country: 'Indonesia', image: kind === 'klasses' ? '/activities/collaboration.jpg' : '', institutionId: '', ...Object.fromEntries(Object.entries(item || {}).filter(([, value]) => typeof value === 'string')) }));
  const [selected, setSelected] = useState<string[]>(() => item && 'coachIds' in item ? item.coachIds || [] : item && 'classIds' in item ? item.classIds || [] : []);
  const [studentIds, setStudentIds] = useState(() => item && kind === 'klasses' ? catalog.students.filter((student) => student.classIds?.includes(item.id)).map((student) => student.id) : []);
  const [deadlines, setDeadlines] = useState(() => item && 'deadlines' in item && item.deadlines ? structuredClone(item.deadlines) : emptyDeadlines());
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [createId] = useState(() => crypto.randomUUID());
  const field = (key: string, label: string, required = true, type = 'text', maxLength = 140) => <AnimatedInput key={key} className="admin-animated-input" label={label} name={key} required={required} type={type} maxLength={maxLength} value={values[key] || ''} onChange={(value) => setValues((current) => ({ ...current, [key]: value }))} />;
  const institution = <TeacherSelect label="Institution" value={values.institutionId || ''} options={[{ id: '', label: 'Independent / KRYAcademia' }, ...catalog.institutions.map((item) => ({ id: item.id, label: item.name }))]} onChange={(institutionId) => setValues((current) => ({ ...current, institutionId }))} />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); onPending(true); setError('');
    try {
      const result = await saveAcademyRecord(kind, item?.id || null, item?.revision || 0, { ...values, createId, ...(kind === 'klasses' ? { coachIds: selected, studentIds, deadlines } : {}), ...(kind === 'students' ? { classIds: selected } : {}) });
      if (result.ok) onSaved(result.catalog); else setError(result.error);
    } catch { setError('Connection interrupted. Your form is unchanged; please retry.'); }
    finally { setPending(false); onPending(false); }
  }
  function check(id: string, checked: boolean) { setSelected((items) => checked ? [...items, id] : items.filter((value) => value !== id)); }
  const syllabuses = kind === 'klasses' && item ? approvedSyllabuses(submissions, item.id) : [];
  const sessions = [...new Map(syllabuses.flatMap((syllabus) => syllabus.content.sessions || []).map((session) => [session.date, session])).values()];
  function addApprovedDates() {
    setDeadlines((current) => ({ ...current, meetings: [...current.meetings, ...sessions.filter((session) => !current.meetings.some((meeting) => meeting.date === session.date)).map((session) => ({ date: session.date, lessonPlan: '', feedback: '' }))].sort((a, b) => a.date.localeCompare(b.date)) }));
  }
  const deadlineField = (key: 'semesterStart' | 'syllabus', label: string) => <label className="teacher-date-field"><span>{label}</span><input aria-label={label} type="date" value={deadlines[key]} onChange={(event) => setDeadlines({ ...deadlines, [key]: event.target.value })} /></label>;
  return <form className="admin-record-form" onSubmit={submit}>
    <span className="surface-eyebrow">{item ? 'Update record' : 'New record'}</span><h2>{item ? 'Edit' : 'Add'} {labels[kind]}</h2>
    <fieldset className="catalog-fields" disabled={pending}>
      {field(kind === 'klasses' ? 'title' : 'name', kind === 'klasses' ? 'Klass title' : 'Name')}
      {kind === 'klasses' && <>
        <div className="teacher-form-grid">{field('category', 'Category')}{institution}</div>
        <div className="teacher-form-grid"><TeacherSelect label="Delivery mode" value={values.mode} options={['Online', 'Onsite', 'Hybrid'].map((label) => ({ id: label, label }))} onChange={(mode) => setValues({ ...values, mode })} />{field('schedule', 'Schedule')}</div>
        {field('image', 'Image path or HTTPS URL', true, 'text', 1000)}
        <label className="admin-text-field"><span>Description</span><textarea aria-label="Description" required rows={4} maxLength={3000} value={values.description || ''} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label>
        <fieldset className="catalog-options"><legend>Coach team</legend>{catalog.coaches.map((coach) => <label htmlFor={`coach-${coach.id}`} key={coach.id}><Checkbox className="admin-checkbox" id={`coach-${coach.id}`} checked={selected.includes(coach.id)} onCheckedChange={(checked) => check(coach.id, checked)} />{coach.name}</label>)}</fieldset>
        <fieldset className="catalog-options"><legend>Students</legend>{catalog.students.map((student) => <label htmlFor={`student-${student.id}`} key={student.id}><Checkbox className="admin-checkbox" id={`student-${student.id}`} checked={studentIds.includes(student.id)} onCheckedChange={(checked) => setStudentIds((items) => checked ? [...items, student.id] : items.filter((id) => id !== student.id))} />{student.name}</label>)}</fieldset>
        <section className="catalog-deadlines"><h3>Submission deadlines</h3><div className="teacher-form-grid">{deadlineField('semesterStart', 'Semester start')}{deadlineField('syllabus', 'Syllabus deadline')}</div>
          <header><h4>Meeting deadlines</h4><div>{sessions.length > 0 && <button type="button" className="admin-secondary-action" onClick={addApprovedDates}>Use approved meetings</button>}<button type="button" className="admin-icon-button" title="Add meeting deadline" aria-label="Add meeting deadline" disabled={deadlines.meetings.length >= 72} onClick={() => setDeadlines({ ...deadlines, meetings: [...deadlines.meetings, { date: '', lessonPlan: '', feedback: '' }] })}><Plus size={17} /></button></div></header>
          {deadlines.meetings.map((meeting, index) => <div className="catalog-deadline-row" key={index}>{(['date', 'lessonPlan', 'feedback'] as const).map((key) => <label className="teacher-date-field" key={key}><span>{key === 'date' ? 'Meeting date' : key === 'lessonPlan' ? 'Lesson plan due' : 'Feedback due'}</span><input aria-label={`Meeting deadline ${index + 1} ${key}`} type="date" required={key === 'date'} value={meeting[key]} onChange={(event) => setDeadlines({ ...deadlines, meetings: deadlines.meetings.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry) })} /></label>)}<button className="admin-icon-button" type="button" aria-label={`Remove deadline ${index + 1}`} title="Remove deadline" onClick={() => setDeadlines({ ...deadlines, meetings: deadlines.meetings.filter((_, i) => i !== index) })}><Trash2 size={17} /></button></div>)}
        </section>
      </>}
      {kind === 'institutions' && <>
        <div className="teacher-form-grid">{field('city', 'City')}{field('country', 'Country')}</div>{field('logo', 'Logo path or HTTPS URL', false, 'text', 1000)}{field('address', 'Address', false, 'text', 500)}
        <div className="teacher-form-grid">{field('contactName', 'Contact person', false)}{field('email', 'Contact email', false, 'email', 200)}</div><div className="teacher-form-grid">{field('phone', 'Contact number', false, 'tel', 40)}{field('website', 'Website', false, 'url', 1000)}</div>
      </>}
      {kind === 'coaches' && <>
        <div className="teacher-form-grid">{field('specialty', 'Teaching specialty')}<TeacherSelect label="Level" value={values.level} options={['Lead Coach', 'Coach'].map((label) => ({ id: label, label }))} onChange={(level) => setValues({ ...values, level })} /></div>
        {field('image', 'Profile image path or HTTPS URL', false, 'text', 1000)}{field('email', 'Contact email', true, 'email', 200)}{field('portalEmail', 'Teacher login email', false, 'email', 200)}
      </>}
      {kind === 'students' && <>
        <div className="teacher-form-grid">{institution}{field('grade', 'Grade', true, 'text', 40)}</div>
        <fieldset className="catalog-options"><legend>Enrolled Klass</legend>{catalog.klasses.map((klass) => <label htmlFor={`enrollment-${klass.id}`} key={klass.id}><Checkbox className="admin-checkbox" id={`enrollment-${klass.id}`} checked={selected.includes(klass.id)} onCheckedChange={(checked) => check(klass.id, checked)} />{klass.title}</label>)}</fieldset>
      </>}
    </fieldset>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    <InteractiveHoverButton className="admin-interactive-action" type="submit" disabled={pending}><Save size={16} />{pending ? 'Saving...' : item ? 'Save changes' : `Add ${labels[kind]}`}</InteractiveHoverButton>
  </form>;
}

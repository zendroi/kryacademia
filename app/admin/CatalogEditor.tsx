'use client';

import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import AnimatedInput from '@/components/smoothui/animated-input';
import Checkbox from '@/components/smoothui/checkbox';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { TeacherSelect } from '../teacher/TeachingControls';
import { approvedSyllabuses, emptyDeadlines, type AcademyCatalog, type CatalogKind, type CatalogRecord } from '@/lib/academy';
import type { TeachingRecord } from '../teacher/teacherData';
import { compressImage, type CompressedImage } from '@/lib/client-image';
import { saveAcademyRecord } from './actions';

const labels = { klasses: 'Klass', institutions: 'institution', coaches: 'coach', students: 'student' };

export default function CatalogEditor({ kind, item, catalog, submissions, onSaved, onPending }: { kind: CatalogKind; item?: CatalogRecord; catalog: AcademyCatalog; submissions: TeachingRecord[]; onSaved: (catalog: AcademyCatalog) => void; onPending: (pending: boolean) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ mode: 'Online', level: 'Coach', country: 'Indonesia', image: '', logo: '', institutionId: '', ...Object.fromEntries(Object.entries(item || {}).filter(([, value]) => typeof value === 'string')) }));
  const [selected, setSelected] = useState<string[]>(() => item && 'coachIds' in item ? item.coachIds || [] : item && 'classIds' in item ? item.classIds || [] : []);
  const [studentIds, setStudentIds] = useState(() => item && kind === 'klasses' ? catalog.students.filter((student) => student.classIds?.includes(item.id)).map((student) => student.id) : []);
  const [deadlines, setDeadlines] = useState(() => item && 'deadlines' in item && item.deadlines ? structuredClone(item.deadlines) : emptyDeadlines());
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageUpload, setImageUpload] = useState<CompressedImage | null>(null);
  const [createId] = useState(() => crypto.randomUUID());
  const klassTypes = [...new Map(catalog.klasses.map((klass) => [klass.klassTypeId || klass.id, klass])).entries()];
  const reusingType = kind === 'klasses' && !item && Boolean(values.klassTypeId);
  const imageKey = kind === 'institutions' ? 'logo' : kind === 'klasses' || kind === 'coaches' ? 'image' : null;
  const imageLabel = kind === 'institutions' ? 'Institution logo' : kind === 'coaches' ? 'Coach profile image' : 'Klass image';
  const imageSrc = imageUpload?.data || (imageKey ? values[imageKey] : '');
  const field = (key: string, label: string, required = true, type = 'text', maxLength = 140) => <AnimatedInput key={key} className="admin-animated-input" label={label} name={key} required={required} type={type} maxLength={maxLength} disabled={reusingType && ['title', 'category'].includes(key)} value={values[key] || ''} onChange={(value) => setValues((current) => ({ ...current, [key]: value }))} />;
  const institution = <TeacherSelect label="Institution" value={values.institutionId || ''} options={[{ id: '', label: 'Independent / KRYAcademia' }, ...catalog.institutions.map((item) => ({ id: item.id, label: item.name }))]} onChange={(institutionId) => setValues((current) => ({ ...current, institutionId }))} />;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (imageBusy) return; setPending(true); onPending(true); setError('');
    try {
      const result = await saveAcademyRecord(kind, item?.id || null, item?.revision || 0, { ...values, createId, ...(imageKey && imageUpload ? { [`${imageKey}Upload`]: imageUpload } : {}), ...(kind === 'klasses' ? { coachIds: selected, studentIds, deadlines } : {}), ...(kind === 'students' ? { classIds: selected } : {}) });
      if (result.ok) onSaved(result.catalog); else setError(result.error);
    } catch { setError('Connection interrupted. Your form is unchanged; please retry.'); }
    finally { setPending(false); onPending(false); }
  }
  async function chooseImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setImageBusy(true); setError('');
    try { setImageUpload(await compressImage(file)); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Could not process this image.'); }
    finally { setImageBusy(false); }
  }
  function check(id: string, checked: boolean) { setSelected((items) => checked ? [...items, id] : items.filter((value) => value !== id)); }
  const syllabuses = kind === 'klasses' && item ? approvedSyllabuses(submissions, item.id) : [];
  const sessions = [...new Map(syllabuses.flatMap((syllabus) => syllabus.content.sessions || []).map((session) => [session.date, session])).values()];
  function addApprovedDates() {
    setDeadlines((current) => ({ ...current, meetings: [...current.meetings, ...sessions.filter((session) => !current.meetings.some((meeting) => meeting.date === session.date)).map((session) => ({ date: session.date, lessonPlan: '', feedback: '' }))].sort((a, b) => a.date.localeCompare(b.date)) }));
  }
  const deadlineField = (key: 'semesterStart' | 'syllabus' | 'semesterRequest', label: string) => <label className="teacher-date-field"><span>{label}</span><input aria-label={label} type="date" value={deadlines[key] || ''} onChange={(event) => setDeadlines({ ...deadlines, [key]: event.target.value })} /></label>;
  return <form className="admin-record-form" onSubmit={submit}>
    <span className="surface-eyebrow">{item ? 'Update record' : 'New record'}</span><h2>{item ? 'Edit' : 'Add'} {labels[kind]}</h2>
    <fieldset className="catalog-fields" disabled={pending || imageBusy}>
      {kind === 'klasses' && !item && <TeacherSelect label="Klass type" value={values.klassTypeId || ''} options={[{ id: '', label: 'New Klass type' }, ...klassTypes.map(([id, klass]) => ({ id, label: klass.title }))]} onChange={(klassTypeId) => {
        const source = klassTypes.find(([id]) => id === klassTypeId)?.[1];
        setValues((current) => ({ ...current, klassTypeId, title: source?.title || '', category: source?.category || '', description: source?.description || '', image: source?.image || '' }));
        setImageUpload(null);
      }} />}
      {field(kind === 'klasses' ? 'title' : 'name', kind === 'klasses' ? 'Klass title' : 'Name')}
      {kind === 'klasses' && <>
        <div className="teacher-form-grid">{field('category', 'Category')}{institution}</div>
        <div className="teacher-form-grid"><TeacherSelect label="Delivery mode" value={values.mode} options={['Online', 'Onsite', 'Hybrid'].map((label) => ({ id: label, label }))} onChange={(mode) => setValues({ ...values, mode })} />{field('schedule', 'Schedule')}</div>
        <CatalogImageUpload label={imageLabel} required src={imageSrc} upload={imageUpload} busy={imageBusy} readOnly={reusingType} onChoose={chooseImage} onClear={() => setImageUpload(null)} />
        <label className="admin-text-field"><span>Description</span><textarea aria-label="Description" required disabled={reusingType} rows={4} maxLength={3000} value={values.description || ''} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label>
        <fieldset className="catalog-options"><legend>Coach team</legend>{catalog.coaches.map((coach) => <label htmlFor={`coach-${coach.id}`} key={coach.id}><Checkbox className="admin-checkbox" id={`coach-${coach.id}`} checked={selected.includes(coach.id)} onCheckedChange={(checked) => check(coach.id, checked)} />{coach.name}</label>)}</fieldset>
        <fieldset className="catalog-options"><legend>Students</legend>{catalog.students.map((student) => <label htmlFor={`student-${student.id}`} key={student.id}><Checkbox className="admin-checkbox" id={`student-${student.id}`} checked={studentIds.includes(student.id)} onCheckedChange={(checked) => setStudentIds((items) => checked ? [...items, student.id] : items.filter((id) => id !== student.id))} />{student.name}</label>)}</fieldset>
        <section className="catalog-deadlines"><h3>Submission deadlines</h3><div className="teacher-form-grid">{deadlineField('semesterStart', 'Semester start')}{deadlineField('syllabus', 'Syllabus deadline')}{deadlineField('semesterRequest', 'Semester request deadline')}</div>
          <header><h4>Meeting deadlines</h4><div>{sessions.length > 0 && <button type="button" className="admin-secondary-action" onClick={addApprovedDates}>Use approved meetings</button>}<button type="button" className="admin-icon-button" title="Add meeting deadline" aria-label="Add meeting deadline" disabled={deadlines.meetings.length >= 72} onClick={() => setDeadlines({ ...deadlines, meetings: [...deadlines.meetings, { date: '', lessonPlan: '', feedback: '' }] })}><Plus size={17} /></button></div></header>
          {deadlines.meetings.map((meeting, index) => <div className="catalog-deadline-row" key={index}>{(['date', 'lessonPlan', 'feedback', 'request'] as const).map((key) => <label className="teacher-date-field" key={key}><span>{key === 'date' ? 'Meeting date' : key === 'lessonPlan' ? 'Lesson plan due' : key === 'feedback' ? 'Feedback due' : 'Class needs due'}</span><input aria-label={`Meeting deadline ${index + 1} ${key}`} type="date" required={key === 'date'} value={meeting[key] || ''} onChange={(event) => setDeadlines({ ...deadlines, meetings: deadlines.meetings.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry) })} /></label>)}<button className="admin-icon-button" type="button" aria-label={`Remove deadline ${index + 1}`} title="Remove deadline" onClick={() => setDeadlines({ ...deadlines, meetings: deadlines.meetings.filter((_, i) => i !== index) })}><Trash2 size={17} /></button></div>)}
        </section>
      </>}
      {kind === 'institutions' && <>
        <div className="teacher-form-grid">{field('city', 'City')}{field('country', 'Country')}</div><CatalogImageUpload label={imageLabel} src={imageSrc} upload={imageUpload} busy={imageBusy} onChoose={chooseImage} onClear={() => setImageUpload(null)} />{field('address', 'Address', false, 'text', 500)}
        <div className="teacher-form-grid">{field('contactName', 'Contact person', false)}{field('email', 'Contact email', false, 'email', 200)}</div><div className="teacher-form-grid">{field('phone', 'Contact number', false, 'tel', 40)}{field('website', 'Website', false, 'url', 1000)}</div>
      </>}
      {kind === 'coaches' && <>
        <div className="teacher-form-grid">{field('specialty', 'Teaching specialty')}<TeacherSelect label="Level" value={values.level} options={['Lead Coach', 'Coach'].map((label) => ({ id: label, label }))} onChange={(level) => setValues({ ...values, level })} /></div>
        <CatalogImageUpload label={imageLabel} src={imageSrc} upload={imageUpload} busy={imageBusy} onChoose={chooseImage} onClear={() => setImageUpload(null)} />{field('email', 'Contact email', true, 'email', 200)}{field('portalEmail', 'Teacher login email', false, 'email', 200)}
      </>}
      {kind === 'students' && <>
        <div className="teacher-form-grid">{institution}{field('grade', 'Grade', true, 'text', 40)}</div>
        <fieldset className="catalog-options"><legend>Enrolled Klass</legend>{catalog.klasses.map((klass) => <label htmlFor={`enrollment-${klass.id}`} key={klass.id}><Checkbox className="admin-checkbox" id={`enrollment-${klass.id}`} checked={selected.includes(klass.id)} onCheckedChange={(checked) => check(klass.id, checked)} />{klass.title}</label>)}</fieldset>
      </>}
    </fieldset>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    <InteractiveHoverButton className="admin-interactive-action" type="submit" disabled={pending || imageBusy}><Save size={16} />{imageBusy ? 'Processing image...' : pending ? 'Saving...' : item ? 'Save changes' : `Add ${labels[kind]}`}</InteractiveHoverButton>
  </form>;
}

function CatalogImageUpload({ label, required = false, src, upload, busy, readOnly = false, onChoose, onClear }: { label: string; required?: boolean; src: string; upload: CompressedImage | null; busy: boolean; readOnly?: boolean; onChoose: (files: FileList | null) => void; onClear: () => void }) {
  return <section className="catalog-image-upload">
    <div className="catalog-image-preview">{src ? <Image src={src} alt={`${label} preview`} fill sizes="128px" unoptimized /> : <ImagePlus size={28} aria-hidden />}</div>
    <div><strong>{label}{required && ' *'}</strong><span>{readOnly ? 'Shared Klass image' : upload ? `${upload.name} / ${Math.ceil(upload.size / 1024)} KB` : src ? 'Current image. Choose a file to replace it.' : 'JPEG, PNG, or WebP / max. 10 MB'}</span>{!readOnly && <div className="catalog-image-actions"><label className="admin-secondary-action"><ImagePlus size={16} />{busy ? 'Processing...' : src ? 'Replace image' : 'Choose image'}<input className="sr-only" aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void onChoose(event.target.files); event.target.value = ''; }} /></label>{upload && <button className="admin-icon-button" type="button" title="Discard selected image" aria-label={`Discard ${label}`} onClick={onClear}><Trash2 size={16} /></button>}</div>}</div>
  </section>;
}

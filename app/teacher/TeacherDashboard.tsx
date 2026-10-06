'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowUpRight, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, FileText, ImagePlus, LayoutDashboard, LogOut, Menu, Package, RefreshCw, Save, Trash2, X } from 'lucide-react';
import AnimatedInput from '@/components/smoothui/animated-input';
import { FormPagePreloader, PageLoadingLink as Link } from '@/components/smoothui/page-preloader';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { logout } from '../login/actions';
import { markTeacherNotificationsRead, refreshTeacherWorkspace, saveTeachingRecord } from './actions';
import { TeacherSelect } from './TeachingControls';
import { attendanceOptions, canvaTemplates, dateLabel, recordLabels, roster, teachingClasses, today, type Attendance, type RecordDraft, type RecordKind, type TeachingConfig, type TeachingContent, type TeachingFile, type TeachingRecord, type TeacherNotification } from './teacherData';

type View = 'overview' | 'meeting' | 'lesson-plan' | 'semester' | 'request' | 'notifications';
const navigation = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'meeting', label: 'Meeting Journal', icon: ClipboardCheck },
  { key: 'lesson-plan', label: 'Lesson Plans', icon: CalendarDays },
  { key: 'semester', label: 'Semester Preparation', icon: BookOpen },
  { key: 'request', label: 'Class Requests', icon: Package },
  { key: 'notifications', label: 'Notifications', icon: Bell },
] as const;
const copy = {
  overview: ['Teacher workspace', 'Welcome back, Teacher.', 'Make room for inspiring lessons, thoughtful feedback, and meaningful progress.'],
  meeting: ['Every meeting matters', 'Meeting Journal', 'Attendance, personal feedback, and classroom reflections in one place.'],
  'lesson-plan': ['Prepare the next step', 'Lesson Plans', 'Shape a clear learning experience for your next meeting.'],
  semester: ['Ready for a new semester', 'Semester Preparation', 'Prepare your syllabus and teaching materials before learning begins.'],
  request: ['Learning essentials', 'Class Requests', 'Submit class needs and follow their progress with the admin team.'],
  notifications: ['Stay in the loop', 'Notifications', 'Submission confirmations, admin updates, and upcoming deadlines.'],
};

function blank(kind: RecordKind, classId: string, config: TeachingConfig): RecordDraft {
  const date = kind === 'syllabus' ? config.semesterStart : kind === 'lesson-plan' ? new Date(new Date(`${today()}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) : today();
  return { kind, classId, date, title: '', files: [], submit: false, content: kind === 'meeting' ? { teacherAttendance: 'Present', students: roster(classId).map((student) => ({ id: student.id, attendance: 'Present', score: '', feedback: '' })), reflection: '' } : kind === 'request' ? { timing: 'Before class', items: '', reason: '' } : {} };
}

function Status({ status }: { status: string }) {
  return <span className={`admin-status status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>;
}

export default function TeacherDashboard({ email, initialRecords, initialNotifications, config, storageError = false }: { email: string; initialRecords: TeachingRecord[]; initialNotifications: TeacherNotification[]; config: TeachingConfig; storageError?: boolean }) {
  const [view, setView] = useState<View>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [records, setRecords] = useState(initialRecords);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [draft, setDraft] = useState(() => blank('meeting', teachingClasses[0].id, config));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unread = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!menuOpen) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = old; window.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function announce(text: string) {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(''), 4000);
  }
  function canLeave() { return !pending && !uploading && (!dirty || window.confirm('Discard unsaved changes? Save a draft to keep them.')); }
  function open(next: View, kind?: RecordKind, record?: TeachingRecord) {
    if (!canLeave()) return;
    if (kind) setDraft(record ? { ...record, submit: false } : blank(kind, draft.classId, config));
    setDirty(false); setError(''); setView(next); setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function changeClass(classId: string) {
    if (!canLeave()) return;
    setDraft(blank(draft.kind, classId, config)); setDirty(false); setError('');
  }
  function patch(update: Partial<RecordDraft>) { setDraft((current) => ({ ...current, ...update })); setDirty(true); setError(''); }
  function edit(record: TeachingRecord) { open(record.kind === 'syllabus' || record.kind === 'slides' ? 'semester' : record.kind, record.kind, record); }
  async function save(submit: boolean) {
    setPending(true); setError(''); setMessage('');
    try {
      const result = await saveTeachingRecord({ ...draft, submit });
      if (!result.ok) { setError(result.error); return; }
      setRecords(result.records); setNotifications(result.notifications); setDirty(false);
      const saved = result.records.find((record) => record.kind === draft.kind && record.classId === draft.classId && record.date === draft.date);
      if (saved) setDraft({ ...saved, submit: false });
      announce(submit ? 'Submitted successfully.' : 'Draft saved.');
    } catch { setError('Connection interrupted. Your form is unchanged; please retry.'); }
    finally { setPending(false); }
  }
  async function markRead() {
    setPending(true);
    try {
      const result = await markTeacherNotificationsRead();
      if (result.ok) setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      else setError(result.error);
    } catch { setError('Could not update notifications.'); }
    finally { setPending(false); }
  }
  async function refresh() {
    if (!canLeave()) return;
    setPending(true); setError('');
    try {
      const result = await refreshTeacherWorkspace();
      if (!result.ok) { setError(result.error); return; }
      setRecords(result.records); setNotifications(result.notifications);
      const current = result.records.find((record) => record.id === draft.id);
      setDraft(current ? { ...current, submit: false } : blank(draft.kind, draft.classId, config));
      setDirty(false); announce('Workspace updated.');
    } catch { setError('Could not refresh. Please retry.'); }
    finally { setPending(false); }
  }
  const isEditor = ['meeting', 'lesson-plan', 'semester', 'request'].includes(view);
  const locked = records.some((record) => record.id === draft.id && ['Approved', 'Fulfilled'].includes(record.status));
  return <MotionConfig reducedMotion="user"><main className="admin-shell teacher-shell">
    <AnimatePresence>{menuOpen && <motion.button className="admin-menu-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}</AnimatePresence>
    <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="admin-brand-row"><Link href="/" className="admin-brand" aria-label="KRYAcademia home"><Image src="/kryacademia-logo.png" alt="" width={42} height={46} priority /><span><strong>KRYAcademia</strong><small>Teacher workspace</small></span></Link><button className="admin-sidebar-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
      <nav className="admin-nav" aria-label="Teacher navigation"><span className="admin-nav-label">Your teaching space</span>{navigation.map(({ key, label, icon: Icon }) => <button key={key} aria-current={view === key ? 'page' : undefined} className={view === key ? 'is-active' : ''} disabled={pending} onClick={() => open(key, key === 'semester' ? 'syllabus' : key === 'overview' || key === 'notifications' ? undefined : key)}><Icon size={18} /><span>{label}</span>{key === 'notifications' && unread > 0 && <b>{unread}</b>}</button>)}</nav>
      <div className="teacher-semester-label"><BookOpen size={17} /><div><strong>Semester preparation</strong><span>{dateLabel(config.semesterStart)}</span>{config.sample && <small>Sample dates</small>}</div></div>
      <div className="admin-sidebar-foot"><Link href="/" onClick={(event) => { if (!canLeave()) event.preventDefault(); }}><ChevronLeft size={17} />Website</Link><form action={logout} onSubmit={(event) => { if (!canLeave()) event.preventDefault(); }}><FormPagePreloader /><button type="submit"><LogOut size={17} />Log out</button></form></div>
    </aside>
    <section className="admin-workspace"><header className="admin-topbar"><button className="admin-menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><span className="teacher-top-date"><CalendarDays size={17} />{dateLabel(today())}</span><div className="admin-top-actions"><span className="admin-demo-badge">Sample roster</span><button className="admin-icon-button" aria-label="Refresh workspace" title="Refresh workspace" disabled={pending || uploading} onClick={() => void refresh()}><RefreshCw size={18} /></button><button className="admin-icon-button" aria-label="Notifications" title="Notifications" onClick={() => open('notifications')}><Bell size={19} />{unread > 0 && <span>{unread}</span>}</button><div className="admin-account"><span>T</span><div><strong>Teacher</strong><small>{email}</small></div></div></div></header>
      <div className="admin-content"><div className="admin-page-heading"><div><span>{copy[view][0]}</span><h1>{copy[view][1]}</h1><p>{copy[view][2]}</p></div><span className="teacher-workspace-tag"><CheckCircle2 size={15} />Teacher portal</span></div>
        {storageError && <div className="teacher-alert" role="alert">Database unavailable. Saving is disabled until the teaching tables are ready. <button onClick={() => window.location.reload()}>Retry</button></div>}
        <AnimatePresence mode="wait" initial={false}><motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
          {view === 'overview' && <Overview records={records} config={config} open={open} edit={edit} />}
          {view === 'notifications' && <Notifications notifications={notifications} config={config} records={records} edit={edit} markRead={markRead} pending={pending} />}
          {isEditor && <>
            {view === 'semester' && <div className="teacher-section-tabs" role="group" aria-label="Semester documents">{(['syllabus', 'slides'] as const).map((kind) => <button key={kind} className={draft.kind === kind ? 'is-active' : ''} onClick={() => open('semester', kind)} disabled={pending}><FileText size={16} />{recordLabels[kind]}</button>)}</div>}
            {records.find((record) => record.id === draft.id)?.reviewerNote && <p className="teacher-review-note"><strong>Admin feedback</strong>{records.find((record) => record.id === draft.id)?.reviewerNote}</p>}
            <RecordEditor key={`${draft.kind}-${draft.id || 'new'}-${draft.classId}`} draft={draft} patch={patch} config={config} pending={pending} uploading={uploading} setUploading={setUploading} locked={locked} storageError={storageError} changeClass={changeClass} save={save} dirty={dirty} error={error} />
            <History records={records.filter((record) => (view === 'semester' ? ['syllabus', 'slides'].includes(record.kind) : record.kind === view))} edit={edit} />
          </>}
        </motion.div></AnimatePresence>
        {view === 'notifications' && error && <p className="teacher-form-error" role="alert">{error}</p>}
      </div>
    </section>
    <AnimatePresence>{message && <motion.div className="admin-toast" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><CheckCircle2 size={19} />{message}</motion.div>}</AnimatePresence>
  </main></MotionConfig>;
}

function Overview({ records, config, open, edit }: { records: TeachingRecord[]; config: TeachingConfig; open: (view: View, kind?: RecordKind, record?: TeachingRecord) => void; edit: (record: TeachingRecord) => void }) {
  const metrics = [
    { label: 'My Klass', value: teachingClasses.length, note: 'Sample teaching assignments', icon: BookOpen },
    { label: 'Meeting journals', value: records.filter((item) => item.kind === 'meeting' && item.status !== 'Draft').length, note: 'Attendance & reflections', icon: ClipboardCheck },
    { label: 'Drafts', value: records.filter((item) => item.status === 'Draft').length, note: 'Ready to continue', icon: FileText },
    { label: 'Open requests', value: records.filter((item) => item.kind === 'request' && ['Submitted', 'Needs revision'].includes(item.status)).length, note: 'With the admin team', icon: Package },
  ];
  return <>
    <div className="admin-metric-grid">{metrics.map(({ label, value, note, icon: Icon }, index) => <article className="admin-metric" key={label}><span>{String(index + 1).padStart(2, '0')}</span><Icon size={20} /><strong>{value}</strong><h2>{label}</h2><p>{note}</p></article>)}</div>
    <section className="teacher-overview-layout"><div className="teacher-class-section"><header className="teacher-section-head"><div><span>Your learning spaces</span><h2>My Klass</h2></div><span>Sample roster</span></header>{teachingClasses.map((klass) => <article className="teacher-class-row" key={klass.id}><Image src={klass.image} alt={klass.title} width={150} height={120} /><div><Status status={klass.mode} /><h3>{klass.title}</h3><p>{klass.school}</p><small><Clock3 size={13} />{klass.schedule}</small></div><button title={`Open journal for ${klass.title}`} aria-label={`Open journal for ${klass.title}`} onClick={() => open('meeting', 'meeting', { ...blank('meeting', klass.id, config), id: '', teacherEmail: '', status: 'Draft', reviewerNote: '', updatedAt: '' })}><ChevronRight size={20} /></button></article>)}</div>
      <aside className="teacher-deadline-panel"><span>Before the semester</span><h2>A little preparation.<br /><em>A bigger impact.</em></h2><div className="teacher-deadline-date"><CalendarDays size={23} /><strong>{dateLabel(config.deadline)}</strong></div><p>Syllabus and semester class needs are due before the semester starts on {dateLabel(config.semesterStart)}.</p>{config.sample && <small>Sample deadline / awaiting official dates</small>}<button onClick={() => open('semester', 'syllabus')}>Prepare syllabus <ArrowUpRight size={17} /></button><button onClick={() => open('request', 'request')}>Request class needs <ArrowUpRight size={17} /></button></aside></section>
    <History records={records.slice(0, 5)} edit={edit} />
  </>;
}

function History({ records, edit }: { records: TeachingRecord[]; edit: (record: TeachingRecord) => void }) {
  return <section className="teacher-history"><header className="teacher-section-head"><div><span>Your teaching record</span><h2>Recent submissions</h2></div><span>{records.length} records</span></header>{records.length ? <div className="teacher-history-list">{records.map((record) => <button key={record.id} onClick={() => edit(record)}><FileText size={20} /><div><strong>{record.title}</strong><small>{recordLabels[record.kind]} / {teachingClasses.find((klass) => klass.id === record.classId)?.title} / {dateLabel(record.date)}</small>{record.reviewerNote && <p>{record.reviewerNote}</p>}</div><Status status={record.status} /><ChevronRight size={18} /></button>)}</div> : <div className="teacher-empty"><FileText size={22} /><strong>No submissions yet</strong><p>Your saved drafts and submitted records will appear here.</p></div>}</section>;
}

function TextArea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="admin-text-field teacher-text-field"><span>{label}{required ? ' *' : ''}</span><textarea rows={4} value={value} maxLength={6000} onChange={(event) => onChange(event.target.value)} /></label>;
}

function RecordEditor({ draft, patch, config, pending, uploading, setUploading, locked, storageError, changeClass, save, dirty, error }: { draft: RecordDraft; patch: (update: Partial<RecordDraft>) => void; config: TeachingConfig; pending: boolean; uploading: boolean; setUploading: (value: boolean) => void; locked: boolean; storageError: boolean; changeClass: (id: string) => void; save: (submit: boolean) => Promise<void>; dirty: boolean; error: string }) {
  const [journalTab, setJournalTab] = useState('attendance');
  const [uploadError, setUploadError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const content = draft.content;
  const update = (update: Partial<TeachingContent>) => patch({ content: { ...content, ...update } });
  const semester = draft.kind === 'syllabus' || (draft.kind === 'request' && content.timing === 'Before semester');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await save(true); }
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true); setUploadError('');
    try {
      if (draft.files.filter((file) => file.mime.startsWith('image/')).length + Array.from(files).filter((file) => file.type.startsWith('image/')).length > 3 || draft.files.filter((file) => file.mime === 'application/pdf').length + Array.from(files).filter((file) => file.type === 'application/pdf').length > 1) throw new Error('Use up to three photos and one PDF per record.');
      const added: TeachingFile[] = [];
      for (const file of Array.from(files)) {
        if (file.type === 'application/pdf') {
          if (file.size > 1048576) throw new Error('PDFs must be 1 MB or smaller.');
          added.push({ id: crypto.randomUUID(), name: file.name.slice(0, 140), mime: file.type, size: file.size, data: await dataUrl(file) });
        } else added.push(await compressPhoto(file));
      }
      const all = [...draft.files, ...added];
      if (all.filter((file) => file.mime.startsWith('image/')).length > 3 || all.filter((file) => file.mime === 'application/pdf').length > 1) throw new Error('Use up to three photos and one PDF per record.');
      patch({ files: all });
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Could not process this file.'); }
    finally { setUploading(false); }
  }
  return <form ref={form} className="teacher-editor" onSubmit={submit}>
    <header className="teacher-editor-header"><div><span>{recordLabels[draft.kind]}</span><h2>{draft.id ? 'Your saved record' : 'Create a new record'}</h2></div><span>{locked ? 'Reviewed / read only' : dirty ? 'Unsaved changes' : draft.id ? 'Saved' : 'New entry'}</span></header>
    {semester && <div className="teacher-inline-deadline"><Clock3 size={17} /><span>Deadline: <strong>{dateLabel(config.deadline)}</strong>{today() > config.deadline && <b> / Late submission</b>}{config.sample && <small> / Sample dates</small>}</span></div>}
    <fieldset disabled={pending || locked || uploading}>
      <div className="teacher-form-grid"><TeacherSelect label="Klass" value={draft.classId} options={teachingClasses.map((klass) => ({ id: klass.id, label: klass.title }))} onChange={changeClass} /><label className="teacher-date-field"><span>{semester ? 'Semester start' : draft.kind === 'request' ? 'Needed by' : draft.kind === 'lesson-plan' ? 'Next meeting' : 'Meeting date'} *</span><input aria-label={semester ? 'Semester start' : draft.kind === 'request' ? 'Needed by' : draft.kind === 'lesson-plan' ? 'Next meeting' : 'Meeting date'} type="date" value={draft.date} readOnly={semester || Boolean(draft.id)} required onChange={(event) => patch({ date: event.target.value })} /></label></div>
      <AnimatedInput className="admin-animated-input" label={draft.kind === 'meeting' ? 'Meeting topic *' : 'Title *'} required maxLength={140} value={draft.title} onChange={(title) => patch({ title })} />
      {draft.kind === 'meeting' && <>
        <div className="teacher-section-tabs" role="group" aria-label="Journal sections">{['attendance', 'feedback'].map((tab) => <button type="button" key={tab} className={journalTab === tab ? 'is-active' : ''} onClick={() => setJournalTab(tab)}>{tab === 'attendance' ? <ClipboardCheck size={16} /> : <FileText size={16} />}{tab === 'attendance' ? 'Attendance' : 'Student & Class Feedback'}</button>)}</div>
        {journalTab === 'attendance' ? <><div className="teacher-attendance-head"><TeacherSelect label="Teacher attendance" value={content.teacherAttendance || 'Present'} options={attendanceOptions.map((label) => ({ id: label, label }))} onChange={(value) => update({ teacherAttendance: value as Attendance })} /><button className="admin-secondary-action" type="button" onClick={() => update({ students: content.students?.map((student) => ({ ...student, attendance: 'Present' })) })}><Check size={15} />All students present</button></div><div className="teacher-attendance-list">{content.students?.map((entry) => <div className="teacher-attendance-row" key={entry.id}><div><strong>{roster(draft.classId).find((student) => student.id === entry.id)?.name}</strong><small>{entry.id.toUpperCase()}</small></div><div className="teacher-attendance-options" role="group" aria-label={`Attendance ${entry.id}`}>{attendanceOptions.map((status) => <button type="button" key={status} aria-pressed={entry.attendance === status} className={entry.attendance === status ? 'is-active' : ''} onClick={() => update({ students: content.students?.map((student) => student.id === entry.id ? { ...student, attendance: status } : student) })}>{status}</button>)}</div></div>)}</div><div className="teacher-attendance-summary"><CheckCircle2 size={17} />{content.students?.filter((student) => ['Present', 'Late'].includes(student.attendance)).length} of {content.students?.length} students attending</div></> : <>
          {content.students?.map((entry) => <section className="teacher-student-feedback" key={entry.id}><header><div><h3>{roster(draft.classId).find((student) => student.id === entry.id)?.name}</h3><Status status={entry.attendance} /></div><label><span>Score / 100</span><input type="number" aria-label={`Score ${entry.id}`} min={0} max={100} step="any" value={entry.score} onChange={(event) => update({ students: content.students?.map((student) => student.id === entry.id ? { ...student, score: event.target.value } : student) })} /></label></header><TextArea label={`Personal feedback ${entry.id}`} value={entry.feedback} required={['Present', 'Late'].includes(entry.attendance)} onChange={(feedback) => update({ students: content.students?.map((student) => student.id === entry.id ? { ...student, feedback } : student) })} /></section>)}
          <TextArea label="Class feedback" required value={content.reflection || ''} onChange={(reflection) => update({ reflection })} />
        </>}
      </>}
      {draft.kind === 'lesson-plan' && <><TextArea label="Learning objectives" required value={content.objectives || ''} onChange={(objectives) => update({ objectives })} /><TextArea label="Learning activities & timing" required value={content.activities || ''} onChange={(activities) => update({ activities })} /><TextArea label="Resources & preparation" value={content.resources || ''} onChange={(resources) => update({ resources })} /></>}
      {draft.kind === 'syllabus' && <><TextArea label="Semester learning objectives" required value={content.objectives || ''} onChange={(objectives) => update({ objectives })} /><TextArea label="Meeting-by-meeting syllabus" required value={content.outline || ''} onChange={(outline) => update({ outline })} /></>}
      {draft.kind === 'slides' && <><div className="teacher-canva-templates"><span>KRYAcademia Canva templates</span><div>{[...(config.canvaTemplate ? [config.canvaTemplate] : []), ...canvaTemplates].map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer"><FileText size={17} />Template {String(index + 1).padStart(2, '0')}<ArrowUpRight size={15} /></a>)}</div></div><AnimatedInput className="admin-animated-input" label="Your Canva slides link" type="url" value={content.canvaUrl || ''} onChange={(canvaUrl) => update({ canvaUrl })} /><p className="teacher-field-note">Canva design link or slides PDF.</p></>}
      {draft.kind === 'request' && <><TeacherSelect label="Request timeframe" value={content.timing || 'Before class'} options={['Before class', 'Before semester'].map((label) => ({ id: label, label }))} onChange={(timing) => patch({ date: timing === 'Before semester' ? config.semesterStart : today(), content: { ...content, timing: timing as 'Before class' | 'Before semester' } })} /><TextArea label="Items & quantities" required value={content.items || ''} onChange={(items) => update({ items })} /><TextArea label="Purpose & classroom needs" required value={content.reason || ''} onChange={(reason) => update({ reason })} /></>}
      <section className="teacher-upload"><div><h3>{draft.kind === 'meeting' ? 'Meeting documentation' : 'Attachments'}</h3><span>Photos: auto-compressed / PDF: max. 1 MB</span></div><label className="admin-secondary-action"><ImagePlus size={17} />{uploading ? 'Processing...' : 'Add photos'}<input className="sr-only" aria-label="Documentation photos" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploading || draft.files.filter((file) => file.mime.startsWith('image/')).length >= 3} onChange={(event) => { void upload(event.target.files); event.target.value = ''; }} /></label>{draft.kind !== 'meeting' && <label className="admin-secondary-action"><FileText size={17} />Add PDF<input className="sr-only" aria-label="Document PDF" type="file" accept="application/pdf" disabled={uploading || draft.files.some((file) => file.mime === 'application/pdf')} onChange={(event) => { void upload(event.target.files); event.target.value = ''; }} /></label>}
        <div className="teacher-upload-previews">{draft.files.map((file) => <div key={file.id}>{file.mime.startsWith('image/') ? <Image src={file.data || `/api/teaching-files/${file.id}`} width={180} height={125} alt={file.name} unoptimized /> : <FileText size={28} />}<strong>{file.name}</strong><span>{Math.ceil(file.size / 1024)} KB</span><button title="Remove attachment" aria-label={`Remove ${file.name}`} type="button" onClick={() => patch({ files: draft.files.filter((item) => item.id !== file.id) })}><Trash2 size={16} /></button></div>)}</div>
        {uploadError && <p className="teacher-form-error" role="alert">{uploadError}</p>}
      </section>
    </fieldset>
    {locked ? <p className="teacher-locked"><CheckCircle2 size={17} />This record has been reviewed and is read only.</p> : <div className="teacher-form-actions"><button className="admin-secondary-action" type="button" disabled={pending || uploading || storageError} onClick={() => { if (form.current?.reportValidity()) void save(false); }}><Save size={16} />Save draft</button><InteractiveHoverButton className="admin-interactive-action" type="submit" disabled={pending || uploading || storageError}>{pending ? 'Saving...' : 'Submit record'}</InteractiveHoverButton></div>}
    {error && <p className="teacher-form-error" role="alert">{error}</p>}
  </form>;
}

function dataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the file.')); reader.readAsDataURL(file); });
}

async function compressPhoto(file: File): Promise<TeachingFile> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10485760) throw new Error('Use JPEG, PNG, or WebP photos up to 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('Photo resolution is too large. Use a photo under 40 megapixels.');
    for (const max of [1440, 1080, 800]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo compression is unavailable in this browser.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', max === 1440 ? 0.78 : 0.58));
      if (blob && blob.size <= 184320) return { id: crypto.randomUUID(), name: `${file.name.replace(/\.[^.]+$/, '').slice(0, 130)}.${blob.type === 'image/webp' ? 'webp' : 'png'}`, mime: blob.type, size: blob.size, data: await dataUrl(blob) };
    }
    throw new Error('This photo is too detailed to compress. Please choose a smaller photo.');
  } finally { bitmap.close(); }
}

function Notifications({ notifications, config, records, edit, markRead, pending }: { notifications: TeacherNotification[]; config: TeachingConfig; records: TeachingRecord[]; edit: (record: TeachingRecord) => void; markRead: () => void; pending: boolean }) {
  const [filter, setFilter] = useState('All');
  const items = notifications.filter((item) => filter === 'All' || !item.read);
  return <>
    <div className="teacher-notification-tools"><div className="teacher-section-tabs" role="group" aria-label="Notification filter">{['All', 'Unread'].map((label) => <button key={label} aria-pressed={filter === label} className={filter === label ? 'is-active' : ''} onClick={() => setFilter(label)}>{label}</button>)}</div><button className="admin-secondary-action" disabled={pending || !notifications.some((item) => !item.read)} onClick={markRead}><Check size={16} />Mark all read</button></div>
    <div className="teacher-channel-strip"><span><CheckCircle2 size={16} />Dashboard active</span><span><Clock3 size={16} />Email not connected</span><span><Clock3 size={16} />WhatsApp not connected</span></div>
    <section className="teacher-notification-list"><article className="teacher-reminder"><CalendarDays size={20} /><div><span>Semester reminder{config.sample ? ' / Sample deadline' : ''}</span><h3>Syllabus & class needs due {dateLabel(config.deadline)}</h3><p>Prepare your semester documents before {dateLabel(config.semesterStart)}.</p></div></article>{items.map((item) => <article key={item.id} className={item.read ? 'is-read' : ''}><Bell size={20} /><div><span>{item.read ? 'Read' : 'Unread'} / {dateLabel(item.createdAt)}</span><h3>{item.title}</h3><p>{item.message}</p><small>Dashboard delivered / Email & WhatsApp not sent</small></div>{records.some((record) => record.id === item.recordId) && <button title="View submission" aria-label={`View ${item.title}`} onClick={() => { const record = records.find((record) => record.id === item.recordId); if (record) edit(record); }}><ChevronRight size={20} /></button>}</article>)}{!items.length && <div className="teacher-empty"><CheckCircle2 size={24} /><strong>{filter === 'Unread' ? 'All caught up' : 'No notifications yet'}</strong></div>}</section>
  </>;
}

'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import AnimatedInput from '@/components/smoothui/animated-input';
import BasicDropdown from '@/components/smoothui/basic-dropdown';
import { FormPagePreloader, PageLoadingLink as Link } from '@/components/smoothui/page-preloader';
import Checkbox from '@/components/smoothui/checkbox';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageCircleQuestion,
  MonitorUp,
  Plus,
  Radio,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { logout } from '../login/actions';
import { reviewTeachingRecord } from '../teacher/actions';
import { TeacherSelect, TeachingAttachments } from '../teacher/TeachingControls';
import { dateLabel, recordLabels, teachingClasses, roster, type TeachingRecord, type RecordStatus } from '../teacher/teacherData';
import {
  approvals,
  coaches,
  inquiries,
  institutions,
  klasses,
  students,
  type CoachRecord,
  type KlassMode,
  type KlassRecord,
  type StudentRecord,
} from './adminData';

type ViewKey = 'overview' | 'klasses' | 'institutions' | 'coaches' | 'students' | 'approvals' | 'reports' | 'inquiries' | 'broadcast';
type Detail =
  | { kind: 'klass'; item: KlassRecord }
  | { kind: 'coach'; item: CoachRecord }
  | { kind: 'student'; item: StudentRecord }
  | { kind: 'institution'; item: (typeof institutions)[number] }
  | { kind: 'inquiry'; item: (typeof inquiries)[number] };
type Records = { klasses: KlassRecord[]; coaches: CoachRecord[]; students: StudentRecord[]; institutions: typeof institutions; inquiries: typeof inquiries; approvals: typeof approvals };
type CreateView = 'klasses' | 'institutions' | 'coaches' | 'students' | 'inquiries';
type Draft = { audience: string; subject: string; message: string; email: boolean; portal: boolean };
const creationLabels = { klasses: 'Klass', institutions: 'institution', coaches: 'coach', students: 'student', inquiries: 'inquiry' };

const navItems: { key: ViewKey; label: string; icon: LucideIcon; badge?: number }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'klasses', label: 'Klass', icon: BookOpen },
  { key: 'institutions', label: 'Institutions', icon: Building2 },
  { key: 'coaches', label: 'Coaches', icon: GraduationCap },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'approvals', label: 'Approvals', icon: ClipboardCheck, badge: 2 },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'inquiries', label: 'Inquiries', icon: MessageCircleQuestion, badge: 2 },
  { key: 'broadcast', label: 'Broadcast', icon: Radio },
];

const viewCopy: Record<ViewKey, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'Admin workspace', title: 'Good morning, Admin.', description: 'A clear view of learning activity, partner institutions, and tasks that need attention.' },
  klasses: { eyebrow: 'Learning operations', title: 'Klass Management', description: 'Monitor active learning experiences, schedules, coaches, and student capacity.' },
  institutions: { eyebrow: 'Partner network', title: 'Institution Management', description: 'Review partner profiles and the Klass experiences running across each institution.' },
  coaches: { eyebrow: 'Learning team', title: 'Coach Management', description: 'See teaching focus, active assignments, and the learners supported by each coach.' },
  students: { eyebrow: 'Learner records', title: 'Student Management', description: 'Track participation, class placement, progress, and attendance in one view.' },
  approvals: { eyebrow: 'Review queue', title: 'Approval Management', description: 'Keep academic submissions and operational requests moving with clear decisions.' },
  reports: { eyebrow: 'Learning evidence', title: 'Reports & Certificates', description: 'Prepare progress reports and certificates for students, classes, and institutions.' },
  inquiries: { eyebrow: 'Incoming interest', title: 'Inquiry List', description: 'Follow up on requests submitted through the KRYAcademia landing page.' },
  broadcast: { eyebrow: 'Communication', title: 'Broadcast Center', description: 'Prepare focused announcements for coaches and partner institutions.' },
};

const pageMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
};

function initials(value: string) {
  return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function StatusChip({ status }: { status: string }) {
  return <span className={`admin-status status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>;
}

function EmptyState() {
  return <div className="admin-empty"><Search size={22} aria-hidden /><strong>No matching records</strong><span>Try a different keyword or filter.</span></div>;
}

function downloadText(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([type.startsWith('text/csv') ? '\uFEFF' : '', content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  downloadText(name, rows.map((row) => row.map((cell) => {
    // Prevent spreadsheet formulas from executing when a user-entered value is exported.
    const value = String(cell).replace(/^[=+@-]/, "'$&");
    return `"${value.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n'));
}

function AdminSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="admin-select"><span>{label}</span><BasicDropdown key={value} label={`${label}: ${value}`} items={options.map((option) => ({ id: option, label: option }))} onChange={(item) => onChange(String(item.id))} /></div>;
}

export default function AdminDashboard({ email, initialSubmissions = [], teachingUnavailable = false }: { email: string; initialSubmissions?: TeachingRecord[]; teachingUnavailable?: boolean }) {
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [createView, setCreateView] = useState<CreateView | null>(null);
  const [records, setRecords] = useState<Records>({ klasses, institutions, coaches, students, inquiries, approvals });
  const [draft, setDraft] = useState<Draft>({ audience: 'All coaches', subject: '', message: '', email: true, portal: true });
  const [toast, setToast] = useState('');
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [reviewing, setReviewing] = useState<TeachingRecord | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function changeView(view: ViewKey) {
    setActiveView(view);
    setQuery('');
    setMenuOpen(false);
    setNotificationsOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function announce(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }

  function updateInquiry(id: string) {
    setRecords((current) => ({ ...current, inquiries: current.inquiries.map((item) => item.id === id ? { ...item, status: 'Contacted' } : item) }));
    setDetail((current) => current?.kind === 'inquiry' ? { ...current, item: { ...current.item, status: 'Contacted' } } : current);
    announce('Demo inquiry marked as contacted.');
  }

  function createRecord(view: CreateView, formData: FormData, mode: KlassMode) {
    const name = String(formData.get('name') || '').trim();
    const school = String(formData.get('institution') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const emailValue = String(formData.get('email') || '').trim();
    const id = crypto.randomUUID();
    setRecords((current) => {
      if (view === 'klasses') return { ...current, klasses: [...current.klasses, { id, title: name, category: String(formData.get('specialty') || 'Innovation'), school, mode, image: '/activities/collaboration.jpg', coaches: [], students: 0, schedule: 'Not scheduled', description }] };
      if (view === 'institutions') return { ...current, institutions: [...current.institutions, { id, name, city: school, classes: 0, students: 0, logo: '', about: description }] };
      if (view === 'coaches') return { ...current, coaches: [...current.coaches, { id, name, specialty: String(formData.get('specialty') || ''), level: 'Coach', image: '', email: emailValue, classes: 0, students: 0, bio: description }] };
      if (view === 'students') return { ...current, students: [...current.students, { id, name, school, grade: String(formData.get('grade') || ''), klass: 'Not assigned', score: 0, attendance: 0 }] };
      return { ...current, inquiries: [...current.inquiries, { id, name, email: emailValue, type: 'General', date: 'Just now', status: 'New', message: description }] };
    });
    setCreateView(null);
    announce(`New ${creationLabels[view]} added to this demo session.`);
  }

  const copy = viewCopy[activeView];
  const teacherPending = submissions.filter((item) => item.status === 'Submitted').length;
  const notificationCount = records.inquiries.filter((item) => item.status === 'New').length + records.approvals.filter((item) => ['Pending', 'Submitted'].includes(item.status)).length + teacherPending;

  return (
    <MotionConfig reducedMotion="user"><main className="admin-shell">
      <AnimatePresence>{menuOpen && <motion.button className="admin-menu-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}</AnimatePresence>

      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-brand-row">
          <Link href="/" className="admin-brand" aria-label="KRYAcademia home">
            <Image src="/kryacademia-logo.png" alt="" width={42} height={46} priority />
            <span><strong>KRYAcademia</strong><small>Admin workspace</small></span>
          </Link>
          <button className="admin-sidebar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          <span className="admin-nav-label">Workspace</span>
          {navItems.map(({ key, label, icon: Icon, badge }) => (
            <button className={activeView === key ? 'is-active' : ''} aria-current={activeView === key ? 'page' : undefined} type="button" key={key} onClick={() => changeView(key)}>
              <Icon size={18} strokeWidth={1.8} aria-hidden />
              <span>{label}</span>
              {badge ? <b>{key === 'approvals' ? records.approvals.filter((item) => ['Pending', 'Submitted'].includes(item.status)).length + teacherPending : records.inquiries.filter((item) => item.status === 'New').length}</b> : null}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <Link href="/"><ChevronLeft size={17} aria-hidden />Website</Link>
          <form action={logout}><FormPagePreloader /><button type="submit"><LogOut size={17} aria-hidden />Log out</button></form>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <button className="admin-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          {!['reports', 'broadcast'].includes(activeView) ? <label className="admin-global-search">
            <Search size={18} aria-hidden />
            <span className="sr-only">Search current section</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${navItems.find((item) => item.key === activeView)?.label.toLowerCase()}...`} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
          </label> : <span className="admin-workspace-label">Admin workspace</span>}
          <div className="admin-top-actions">
            <div className="admin-notification-wrap">
              <button className="admin-icon-button" type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications" aria-expanded={notificationsOpen}>
                <Bell size={19} />{notificationCount > 0 && <span>{notificationCount}</span>}
              </button>
              <AnimatePresence>{notificationsOpen && <NotificationPanel records={records} teacherPending={teacherPending} onClose={() => setNotificationsOpen(false)} changeView={changeView} />}</AnimatePresence>
            </div>
            <span className="admin-demo-badge">Demo data</span>
            <div className="admin-account"><span>{initials(email)}</span><div><strong>Admin</strong><small>{email}</small></div></div>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div><span>{copy.eyebrow}<small className="admin-mobile-demo"> / Demo data</small></span><h1>{copy.title}</h1><p>{copy.description}</p></div>
            {activeView in creationLabels && <button className="admin-primary-action" title={`Add ${creationLabels[activeView as CreateView]}`} aria-label={`Add ${creationLabels[activeView as CreateView]}`} type="button" onClick={() => setCreateView(activeView as CreateView)}><Plus size={17} />Add {creationLabels[activeView as CreateView]}</button>}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={activeView} {...pageMotion}>
              {activeView === 'overview' && <OverviewView records={records} query={query} openDetail={setDetail} changeView={changeView} />}
              {activeView === 'klasses' && <KlassView klasses={records.klasses} query={query} openDetail={setDetail} />}
              {activeView === 'institutions' && <InstitutionView institutions={records.institutions} query={query} openDetail={setDetail} />}
              {activeView === 'coaches' && <CoachView coaches={records.coaches} query={query} openDetail={setDetail} />}
              {activeView === 'students' && <StudentView students={records.students} query={query} openDetail={setDetail} />}
              {activeView === 'approvals' && <><section className="teacher-review-queue"><header className="teacher-section-head"><div><span>Live teacher submissions</span><h2>Teacher review queue</h2></div><span>{submissions.length} records</span></header>{teachingUnavailable ? <p className="teacher-form-error">Teacher submissions are temporarily unavailable.</p> : submissions.filter((item) => `${item.title} ${item.teacherEmail}`.toLowerCase().includes(query.toLowerCase())).map((item) => <article className="teacher-review-row" key={item.id}><div><strong>{item.title}</strong><small>{recordLabels[item.kind]} / {item.teacherEmail} / {dateLabel(item.date)}</small></div><StatusChip status={item.status} /><button className="admin-secondary-action" onClick={() => setReviewing(item)}>Review <ChevronRight size={16} /></button></article>)}{!teachingUnavailable && !submissions.length && <p>No teacher submissions yet.</p>}</section><ApprovalView approvals={records.approvals} onApprove={(id) => { setRecords((current) => ({ ...current, approvals: current.approvals.map((item) => item.id === id ? { ...item, status: 'Approved' } : item) })); announce('Demo request approved.'); }} query={query} /></>}
              {activeView === 'reports' && <ReportView records={records} announce={announce} />}
              {activeView === 'inquiries' && <InquiryView inquiries={records.inquiries} query={query} openDetail={setDetail} />}
              {activeView === 'broadcast' && <BroadcastView draft={draft} setDraft={setDraft} records={records} announce={announce} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>{detail && <DetailModal records={records} detail={detail} onClose={() => setDetail(null)} updateInquiry={updateInquiry} />}</AnimatePresence>
      <AnimatePresence>{createView && <RecordForm view={createView} onClose={() => setCreateView(null)} onCreate={createRecord} />}</AnimatePresence>
      <AnimatePresence>{reviewing && <TeacherReview record={reviewing} onClose={() => setReviewing(null)} onReviewed={(items) => { setSubmissions(items); setReviewing(null); announce('Review saved. Teacher notified in their dashboard.'); }} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div className="admin-toast" role="status" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><CheckCircle2 size={18} />{toast}</motion.div>}</AnimatePresence>
    </main></MotionConfig>
  );
}

function NotificationPanel({ records, teacherPending, onClose, changeView }: { records: Records; teacherPending: number; onClose: () => void; changeView: (view: ViewKey) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function dismiss(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !panel.current?.parentElement?.contains(event.target as Node)) onClose();
    }
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, [onClose]);
  return (
    <motion.div ref={panel} className="admin-notifications" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.2 }}>
      <div><strong>Notifications</strong><button type="button" onClick={onClose} aria-label="Close notifications"><X size={16} /></button></div>
      {teacherPending > 0 && <button type="button" onClick={() => changeView('approvals')}><span className="notification-dot" /><div><strong>{teacherPending} teacher submissions</strong><small>Waiting for review</small></div></button>}
      {records.inquiries.filter((item) => item.status === 'New').map((item) => <button key={item.id} type="button" onClick={() => changeView('inquiries')}><span className="notification-dot" /><div><strong>New inquiry: {item.name}</strong><small>{item.date}</small></div></button>)}
      {records.approvals.filter((item) => ['Pending', 'Submitted'].includes(item.status)).map((item) => <button key={item.id} type="button" onClick={() => changeView('approvals')}><span className="notification-dot" /><div><strong>{item.owner}: {item.type}</strong><small>{item.status}</small></div></button>)}
      <button className="notifications-all" type="button" onClick={onClose}>Close notifications</button>
    </motion.div>
  );
}

function OverviewView({ records, query, openDetail, changeView }: { records: Records; query: string; openDetail: (detail: Detail) => void; changeView: (view: ViewKey) => void }) {
  const { klasses, institutions, students, coaches, approvals, inquiries } = records;
  const matchingInquiries = inquiries.filter((item) => `${item.name} ${item.type}`.toLowerCase().includes(query.toLowerCase()));
  const matchingApprovals = approvals.filter((item) => item.status !== 'Approved' && `${item.owner} ${item.type}`.toLowerCase().includes(query.toLowerCase()));
  const metrics = [
    { label: 'Active Klass', value: klasses.length, note: `${klasses.filter((item) => item.mode === 'Online').length} online experiences`, icon: BookOpen },
    { label: 'Partner Institutions', value: institutions.length, note: 'Learning partnerships', icon: Building2 },
    { label: 'Active Students', value: students.length, note: 'Registered learners', icon: Users },
    { label: 'Coaches', value: coaches.length, note: `${new Set(coaches.map((item) => item.specialty)).size} teaching specialties`, icon: GraduationCap },
  ];
  return <div className="admin-overview">
    <section className="admin-metric-grid" aria-label="Key metrics">
      {metrics.map(({ label, value, note, icon: Icon }, index) => <article className="admin-metric" key={label}><span>{String(index + 1).padStart(2, '0')}</span><Icon size={20} aria-hidden /><strong>{value}</strong><h2>{label}</h2><p>{note}</p></article>)}
    </section>
    <section className="admin-overview-grid">
      <article className="admin-surface admin-priority">
        <header><div><span>Needs attention</span><h2>Approval queue</h2></div><button type="button" onClick={() => changeView('approvals')}>View all <ChevronRight size={16} /></button></header>
        <div className="admin-table-wrap"><table><thead><tr><th>Coach</th><th>Request</th><th>Deadline</th><th>Status</th></tr></thead><tbody>{matchingApprovals.slice(0, 3).map((item) => <tr key={item.id}><td><strong>{item.owner}</strong></td><td>{item.type}<small>{item.detail}</small></td><td>{item.due}</td><td><StatusChip status={item.status} /></td></tr>)}</tbody></table>{!matchingApprovals.length && <EmptyState />}</div>
      </article>
      <aside className="admin-surface admin-agenda">
        <header><span>This week</span><h2>Learning rhythm</h2></header>
        {[['06', 'Oct', 'STEAMaker review', 'Sekolah Cikal, 13:00'], ['08', 'Oct', 'Biotech lab', 'Xin Zhong, 10:00'], ['10', 'Oct', 'Coach reflection', 'Online, 16:00']].map(([day, month, title, meta]) => <div className="agenda-row" key={title}><b>{day}<small>{month}</small></b><div><strong>{title}</strong><span>{meta}</span></div></div>)}
      </aside>
    </section>
    <section className="admin-surface admin-recent">
      <header><div><span>Latest conversations</span><h2>Recent inquiries</h2></div><button type="button" onClick={() => changeView('inquiries')}>View all <ChevronRight size={16} /></button></header>
      <div className="admin-inquiry-preview">{matchingInquiries.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => openDetail({ kind: 'inquiry', item })}><span>{initials(item.name)}</span><div><strong>{item.name}</strong><small>{item.type}</small></div><StatusChip status={item.status} /><ChevronRight size={17} /></button>)}{!matchingInquiries.length && <EmptyState />}</div>
    </section>
  </div>;
}

function KlassView({ klasses, query, openDetail }: { klasses: KlassRecord[]; query: string; openDetail: (detail: Detail) => void }) {
  const [mode, setMode] = useState<'All' | KlassMode>('All');
  const filtered = klasses.filter((item) => (mode === 'All' || item.mode === mode) && `${item.title} ${item.school} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="admin-filter-row" role="group" aria-label="Filter classes by mode">{(['All', 'Online', 'Onsite', 'Hybrid'] as const).map((item) => <button aria-pressed={mode === item} className={mode === item ? 'is-active' : ''} type="button" key={item} onClick={() => setMode(item)}>{item}</button>)}</div>
    {filtered.length ? <section className="admin-card-grid klass-grid">{filtered.map((klass) => <button className="admin-klass-card" type="button" key={klass.id} onClick={() => openDetail({ kind: 'klass', item: klass })}>
      <div className="admin-card-image"><Image src={klass.image} alt={`${klass.title} learning documentation`} fill sizes="(max-width: 720px) 100vw, 33vw" /><span className={`mode-${klass.mode.toLowerCase()}`}>{klass.mode}</span></div>
      <div className="admin-card-body"><span>{klass.category}</span><h2>{klass.title}</h2><p>{klass.school}</p><footer><span><Users size={15} />{klass.students} students</span><div>{klass.coaches.slice(0, 2).map((coach) => <b key={coach}>{initials(coach)}</b>)}</div></footer></div>
    </button>)}</section> : <EmptyState />}
  </>;
}

function InstitutionView({ institutions, query, openDetail }: { institutions: typeof import('./adminData').institutions; query: string; openDetail: (detail: Detail) => void }) {
  const filtered = institutions.filter((item) => `${item.name} ${item.city}`.toLowerCase().includes(query.toLowerCase()));
  return filtered.length ? <section className="admin-card-grid institution-grid">{filtered.map((item) => <button className="admin-institution-card" type="button" key={item.id} onClick={() => openDetail({ kind: 'institution', item })}>
    <div className="institution-logo">{item.logo ? <Image src={item.logo} alt={`${item.name} logo`} fill sizes="120px" /> : <span>{initials(item.name)}</span>}</div>
    <span>Partner institution</span><h2>{item.name}</h2><p>{item.city}, Indonesia</p><footer><div><strong>{item.classes}</strong><small>Active Klass</small></div><div><strong>{item.students}</strong><small>Students</small></div><ChevronRight size={20} /></footer>
  </button>)}</section> : <EmptyState />;
}

function CoachView({ coaches, query, openDetail }: { coaches: CoachRecord[]; query: string; openDetail: (detail: Detail) => void }) {
  const filtered = coaches.filter((item) => `${item.name} ${item.specialty}`.toLowerCase().includes(query.toLowerCase()));
  return filtered.length ? <section className="admin-card-grid coach-grid">{filtered.map((coach) => <button className="admin-coach-card" type="button" key={coach.id} onClick={() => openDetail({ kind: 'coach', item: coach })}>
    <div className="coach-photo">{coach.image ? <Image src={coach.image} alt={coach.name} fill sizes="(max-width: 720px) 34vw, 20vw" /> : <span>{initials(coach.name)}</span>}</div>
    <div><span>{coach.level}</span><h2>{coach.name}</h2><p>{coach.specialty}</p><footer><strong>{coach.classes}<small>Klass</small></strong><strong>{coach.students}<small>Students</small></strong><ChevronRight size={19} /></footer></div>
  </button>)}</section> : <EmptyState />;
}

function StudentView({ students, query, openDetail }: { students: StudentRecord[]; query: string; openDetail: (detail: Detail) => void }) {
  const [school, setSchool] = useState('All institutions');
  const schools = ['All institutions', ...Array.from(new Set(students.map((item) => item.school)))];
  const filtered = students.filter((item) => (school === 'All institutions' || item.school === school) && `${item.name} ${item.school} ${item.klass}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <AdminSelect label="Institution" value={school} options={schools} onChange={setSchool} />
    {filtered.length ? <section className="admin-card-grid student-grid">{filtered.map((student, index) => <button className="admin-student-card" type="button" key={student.id} onClick={() => openDetail({ kind: 'student', item: student })}>
      <span className={`student-avatar avatar-${index % 4}`}>{initials(student.name)}</span><div><small>{student.grade}</small><h2>{student.name}</h2><p>{student.school}</p><span>{student.klass}</span></div><footer><strong>{student.score}<small>Avg. score</small></strong><strong>{student.attendance}%<small>Attendance</small></strong></footer>
    </button>)}</section> : <EmptyState />}
  </>;
}

function ApprovalView({ approvals, query, onApprove }: { approvals: Records['approvals']; query: string; onApprove: (id: string) => void }) {
  const [status, setStatus] = useState('All statuses');
  const filtered = approvals.filter((item) => (status === 'All statuses' || item.status === status) && `${item.owner} ${item.type} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="admin-surface admin-data-surface">
    <div className="admin-data-tools"><AdminSelect label="Status" value={status} options={['All statuses', 'Pending', 'Submitted', 'Approved', 'Needs revision']} onChange={setStatus} /><span>{filtered.length} requests</span></div>
    {filtered.length ? <div className="admin-table-wrap"><table><thead><tr><th>Coach</th><th>Request</th><th>Deadline</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.owner}</strong></td><td>{item.type}<small>{item.detail}</small></td><td>{item.due}</td><td><StatusChip status={item.status} /></td><td><div className="table-actions"><button type="button" disabled={item.status === 'Approved'} onClick={() => onApprove(item.id)} title={`Approve ${item.type}`} aria-label={`Approve ${item.type}`}><Check size={16} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState />}
  </section>;
}

function ReportView({ records, announce }: { records: Records; announce: (message: string) => void }) {
  const [reportType, setReportType] = useState('Student progress');
  const [studentName, setStudentName] = useState(records.students[0]?.name || '');
  const types = ['Student progress', 'Klass summary', 'Institution activity', 'Coach performance', 'Certificate'];
  function generate() {
    if (reportType === 'Certificate') {
      const student = records.students.find((item) => item.name === studentName);
      if (!student) return;
      const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
      downloadText('kryacademia-sample-certificate.html', `<!doctype html><html lang="en"><meta charset="utf-8"><title>Sample Certificate</title><style>body{margin:60px;font-family:Arial,sans-serif;text-align:center;color:#173051}main{border:2px solid #173051;padding:60px}small{color:#e8001b}h1{font-size:36px}h2{font-size:32px}</style><main><small>SAMPLE / DEMO DATA</small><h1>KRYAcademia</h1><p>Certificate of Participation</p><h2>${escape(student.name)}</h2><p>${escape(student.klass)}</p><p>${escape(student.school)}</p></main></html>`, 'text/html;charset=utf-8');
    } else {
      const rows: (string | number)[][] = reportType === 'Student progress'
        ? [['Student', 'Institution', 'Klass', 'Score', 'Attendance'], ...records.students.map((item) => [item.name, item.school, item.klass, item.score, item.attendance])]
        : reportType === 'Klass summary'
          ? [['Klass', 'Institution', 'Mode', 'Students', 'Schedule'], ...records.klasses.map((item) => [item.title, item.school, item.mode, item.students, item.schedule])]
          : reportType === 'Institution activity'
            ? [['Institution', 'City', 'Klass', 'Students'], ...records.institutions.map((item) => [item.name, item.city, item.classes, item.students])]
            : [['Coach', 'Specialty', 'Klass', 'Students'], ...records.coaches.map((item) => [item.name, item.specialty, item.classes, item.students])];
      downloadCsv(`kryacademia-${reportType.toLowerCase().replaceAll(' ', '-')}.csv`, rows);
    }
    announce('Demo document downloaded.');
  }
  return <section className="admin-report-layout">
    <div className="admin-surface report-form"><span className="surface-eyebrow">Report setup</span><h2>Choose the evidence you need.</h2>
      <fieldset><legend>Report type</legend>{types.map((item) => <label key={item}><input type="radio" name="report-type" value={item} checked={reportType === item} onChange={() => setReportType(item)} /><span>{item}</span></label>)}</fieldset>
      {reportType === 'Certificate' && <AdminSelect label="Student" value={studentName} options={records.students.map((item) => item.name)} onChange={setStudentName} />}
      <button className="admin-primary-action wide" type="button" onClick={generate}><Download size={17} />Download {reportType === 'Certificate' ? 'sample certificate' : 'report'}</button>
    </div>
    <aside className="admin-surface report-preview"><span>Document preview</span><div className="report-paper"><Image src="/kryacademia-logo.png" alt="" width={38} height={42} /><small>KRYAcademia / Demo data</small><h3>{reportType}</h3>{reportType === 'Certificate' ? <><strong>{studentName}</strong><p>Certificate of Participation</p></> : <div className="report-sample">{(reportType === 'Student progress' ? records.students.map((item) => `${item.name} / ${item.score}`) : reportType === 'Klass summary' ? records.klasses.map((item) => `${item.title} / ${item.mode}`) : reportType === 'Institution activity' ? records.institutions.map((item) => `${item.name} / ${item.city}`) : records.coaches.map((item) => `${item.name} / ${item.specialty}`)).slice(0, 5).map((row) => <p key={row}>{row}</p>)}</div>}</div></aside>
  </section>;
}

function InquiryView({ inquiries, query, openDetail }: { inquiries: Records['inquiries']; query: string; openDetail: (detail: Detail) => void }) {
  const [status, setStatus] = useState('All statuses');
  const filtered = inquiries.filter((item) => (status === 'All statuses' || item.status === status) && `${item.name} ${item.email} ${item.type}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="admin-surface admin-data-surface">
    <div className="admin-data-tools"><AdminSelect label="Status" value={status} options={['All statuses', 'New', 'Contacted', 'Resolved']} onChange={setStatus} /><button className="admin-secondary-action" type="button" onClick={() => downloadCsv('kryacademia-inquiries.csv', [['Name', 'Email', 'Type', 'Received', 'Status', 'Message'], ...filtered.map((item) => [item.name, item.email, item.type, item.date, item.status, item.message])])}><Download size={16} />Export</button></div>
    {filtered.length ? <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Inquiry type</th><th>Date received</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.email}</small></td><td>{item.type}</td><td>{item.date}</td><td><StatusChip status={item.status} /></td><td><button className="table-open" type="button" onClick={() => openDetail({ kind: 'inquiry', item })}>Open <ChevronRight size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState />}
  </section>;
}

function BroadcastView({ draft, setDraft, records, announce }: { draft: Draft; setDraft: (draft: Draft) => void; records: Records; announce: (message: string) => void }) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.email && !draft.portal) { setError('Select at least one delivery channel.'); return; }
    if (!draft.subject.trim() || !draft.message.trim()) { setError('Enter a subject and a message.'); return; }
    setError('');
    downloadText('kryacademia-broadcast.json', JSON.stringify({ ...draft, status: 'Demo draft', sent: false }, null, 2), 'application/json');
    announce('Broadcast prepared and downloaded. No message sent.');
  }
  return <section className="admin-broadcast-layout">
    <form className="admin-surface broadcast-form" onSubmit={submit}>
      <span className="surface-eyebrow">New broadcast</span><h2>Share a focused update.</h2>
      <AdminSelect label="Audience" value={draft.audience} options={['All coaches', 'Partner institutions']} onChange={(audience) => setDraft({ ...draft, audience })} />
      <fieldset className="channel-options"><legend>Delivery channel</legend><label htmlFor="broadcast-email"><Checkbox id="broadcast-email" className="admin-checkbox" checked={draft.email} onCheckedChange={(email) => setDraft({ ...draft, email })} />Email</label><label htmlFor="broadcast-portal"><Checkbox id="broadcast-portal" className="admin-checkbox" checked={draft.portal} onCheckedChange={(portal) => setDraft({ ...draft, portal })} />Portal</label></fieldset>
      <AnimatedInput className="admin-animated-input" label="Subject" name="subject" required maxLength={200} value={draft.subject} onChange={(subject) => setDraft({ ...draft, subject })} />
      <label className="admin-text-field"><span>Message</span><textarea required rows={7} maxLength={5000} value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></label>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      <div className="broadcast-actions"><InteractiveHoverButton className="admin-interactive-action" type="submit">Prepare broadcast</InteractiveHoverButton><button className="admin-secondary-action" type="button" onClick={() => { downloadText('kryacademia-draft.json', JSON.stringify(draft, null, 2), 'application/json'); announce('Draft downloaded.'); }}><Download size={16} />Save draft</button></div>
    </form>
    <aside className="admin-surface broadcast-aside"><span>Delivery summary</span><h2>{draft.audience}</h2><div><strong>{draft.audience === 'All coaches' ? records.coaches.length : records.institutions.length}</strong><small>Demo recipients</small></div><div><strong>{Number(draft.email) + Number(draft.portal)}</strong><small>Active channels</small></div><p>Draft / not sent</p></aside>
  </section>;
}

function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <dialog ref={dialog} className="admin-modal-backdrop" aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section className="admin-detail-modal" initial={{ opacity: 0, y: 32, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <button className="admin-modal-close" type="button" onClick={onClose} aria-label="Close details" autoFocus><X size={20} /></button>
      {children}
    </motion.section>
  </dialog>;
}

function TeacherReview({ record, onClose, onReviewed }: { record: TeachingRecord; onClose: () => void; onReviewed: (records: TeachingRecord[]) => void }) {
  const [status, setStatus] = useState<RecordStatus>('Approved');
  const [note, setNote] = useState(record.reviewerNote);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const labels = { teacherAttendance: 'Teacher attendance', reflection: 'Class feedback', objectives: 'Learning objectives', activities: 'Activities', resources: 'Resources', outline: 'Syllabus outline', canvaUrl: 'Canva design', items: 'Items & quantities', reason: 'Purpose', timing: 'Request timeframe' };
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError('');
    try {
      const result = await reviewTeachingRecord(record.id, status, note);
      if (result.ok) onReviewed(result.records); else setError(result.error);
    } catch { setError('Could not save the review. Please retry.'); }
    finally { setPending(false); }
  }
  return <ModalFrame title="Teacher submission review" onClose={() => { if (!pending) onClose(); }}>
    <div className="teacher-submission-heading"><span className="surface-eyebrow">{recordLabels[record.kind]}</span><h2>{record.title}</h2><p>{record.teacherEmail} / {teachingClasses.find((item) => item.id === record.classId)?.title} / {dateLabel(record.date)}</p></div><StatusChip status={record.status} />
    <dl className="teacher-review-fields">{Object.entries(labels).map(([key, label]) => { const value = record.content[key as keyof typeof labels]; return value ? <div key={key}><dt>{label}</dt><dd>{key === 'canvaUrl' ? <a href={value} target="_blank" rel="noopener noreferrer">Open Canva design</a> : value}</dd></div> : null; })}{record.content.students?.map((student) => <div key={student.id}><dt>{roster(record.classId).find((item) => item.id === student.id)?.name}</dt><dd>{student.attendance} / Score: {student.score || '-'}<br />{student.feedback}</dd></div>)}</dl>
    <TeachingAttachments files={record.files} />
    <form className="teacher-review-controls" onSubmit={submit}><fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0 }}><TeacherSelect label="Review status" value={status} options={['Approved', 'Needs revision', 'Rejected', ...(record.kind === 'request' ? ['Fulfilled'] : [])].map((label) => ({ id: label, label }))} onChange={(value) => setStatus(value as RecordStatus)} /><label><span>Admin note{['Needs revision', 'Rejected'].includes(status) ? ' *' : ''}</span><textarea aria-label="Admin note" required={['Needs revision', 'Rejected'].includes(status)} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} /></label></fieldset><button className="admin-primary-action" disabled={pending}>{pending ? 'Saving...' : 'Save review'}</button>{error && <p className="teacher-form-error" role="alert">{error}</p>}</form>
  </ModalFrame>;
}

function DetailModal({ detail, onClose, records, updateInquiry }: { detail: Detail; onClose: () => void; records: Records; updateInquiry: (id: string) => void }) {
  return <ModalFrame title={`${detail.kind} details`} onClose={onClose}>
    {detail.kind === 'klass' && <KlassDetail item={detail.item} />}
    {detail.kind === 'coach' && <CoachDetail item={detail.item} klasses={records.klasses} />}
    {detail.kind === 'student' && <StudentDetail item={detail.item} />}
    {detail.kind === 'institution' && <InstitutionDetail item={detail.item} klasses={records.klasses} />}
    {detail.kind === 'inquiry' && <InquiryDetail item={detail.item} onContacted={() => updateInquiry(detail.item.id)} />}
  </ModalFrame>;
}

function RecordForm({ view, onClose, onCreate }: { view: CreateView; onClose: () => void; onCreate: (view: CreateView, data: FormData, mode: KlassMode) => void }) {
  const [mode, setMode] = useState<KlassMode>('Online');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if ([...data.values()].some((value) => !String(value).trim())) { setError('Please complete all fields.'); return; }
    onCreate(view, data, mode);
  }
  return <ModalFrame title={`Add ${creationLabels[view]}`} onClose={onClose}><form className="admin-record-form" onSubmit={submit}>
    <span className="surface-eyebrow">New demo record</span><h2>Add {creationLabels[view]}</h2>
    <AnimatedInput className="admin-animated-input" label={view === 'klasses' ? 'Klass title' : 'Name'} name="name" required maxLength={120} />
    {(view === 'klasses' || view === 'students' || view === 'institutions') && <AnimatedInput className="admin-animated-input" label={view === 'institutions' ? 'City' : 'Institution'} name="institution" required maxLength={120} />}
    {(view === 'klasses' || view === 'coaches') && <AnimatedInput className="admin-animated-input" label={view === 'coaches' ? 'Teaching specialty' : 'Category'} name="specialty" required maxLength={100} />}
    {(view === 'coaches' || view === 'inquiries') && <AnimatedInput className="admin-animated-input" label="Email" name="email" type="email" required maxLength={200} />}
    {view === 'students' && <AnimatedInput className="admin-animated-input" label="Grade" name="grade" required maxLength={40} />}
    {view === 'klasses' && <fieldset className="admin-mode-field"><legend>Delivery mode</legend><div className="admin-filter-row">{(['Online', 'Onsite', 'Hybrid'] as const).map((value) => <button type="button" key={value} aria-pressed={mode === value} className={mode === value ? 'is-active' : ''} onClick={() => setMode(value)}>{value}</button>)}</div></fieldset>}
    {view !== 'students' && <label className="admin-text-field"><span>{view === 'inquiries' ? 'Message' : 'Description'}</span><textarea required name="description" rows={4} maxLength={3000} /></label>}
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    <InteractiveHoverButton className="admin-interactive-action" type="submit">Add {creationLabels[view]}</InteractiveHoverButton>
  </form></ModalFrame>;
}

function KlassDetail({ item }: { item: KlassRecord }) {
  return <><div className="detail-hero"><div className="detail-photo"><Image src={item.image} alt={`${item.title} documentation`} fill sizes="(max-width: 720px) 100vw, 42vw" /></div><div><span>{item.category}</span><h2>{item.title}</h2><p>{item.school}</p><StatusChip status={item.mode} /></div></div>
    <div className="detail-content-grid"><div><span className="surface-eyebrow">Klass overview</span><p>{item.description}</p><dl><div><dt>Schedule</dt><dd><CalendarDays size={16} />{item.schedule}</dd></div><div><dt>Students</dt><dd><Users size={16} />{item.students} active learners</dd></div><div><dt>Delivery</dt><dd><MonitorUp size={16} />{item.mode}</dd></div></dl></div><div><span className="surface-eyebrow">Coach team</span>{item.coaches.map((coach) => <div className="detail-person" key={coach}><span>{initials(coach)}</span><div><strong>{coach}</strong><small>KRYAcademia Coach</small></div></div>)}</div></div>
    <div className="detail-section"><header><div><span className="surface-eyebrow">Learning journey</span><h3>Sample sessions</h3></div></header>{['Question framing & exploration', 'Prototype sprint', 'Reflection & presentation'].map((title, index) => <article className="session-row" key={title}><b>{String(index + 1).padStart(2, '0')}</b><div><h4>{title}</h4><p>Students document decisions, evidence, and the next step in their project.</p></div></article>)}</div></>;
}

function CoachDetail({ item, klasses }: { item: CoachRecord; klasses: KlassRecord[] }) {
  const assigned = klasses.filter((klass) => klass.coaches.includes(item.name));
  return <><div className="profile-detail"><div className="profile-photo">{item.image ? <Image src={item.image} alt={item.name} fill sizes="180px" /> : <span>{initials(item.name)}</span>}</div><div><span>{item.level}</span><h2>{item.name}</h2><p>{item.specialty} Coach</p><a href={`mailto:${item.email}`}><Mail size={15} />{item.email}</a></div><div className="profile-stats"><strong>{item.classes}<small>Klass</small></strong><strong>{item.students}<small>Students</small></strong></div></div><div className="detail-copy"><span className="surface-eyebrow">Teaching approach</span><h3>Learning through thoughtful practice.</h3><p>{item.bio}</p></div><div className="detail-section"><header><div><span className="surface-eyebrow">Current work</span><h3>Assigned Klass</h3></div></header>{assigned.length ? assigned.map((klass) => <article className="compact-klass" key={klass.id}><div><Image src={klass.image} alt="" fill sizes="100px" /></div><span><strong>{klass.title}</strong><small>{klass.school} / {klass.mode}</small></span></article>) : <p className="detail-muted">No active assignment.</p>}</div></>;
}

function StudentDetail({ item }: { item: StudentRecord }) {
  return <><div className="student-detail-head"><span className="student-avatar avatar-1">{initials(item.name)}</span><div><span>{item.grade}</span><h2>{item.name}</h2><p>{item.school} / {item.klass}</p></div><button type="button" onClick={() => downloadCsv('kryacademia-student-report.csv', [['Student', 'Institution', 'Klass', 'Score', 'Attendance'], [item.name, item.school, item.klass, item.score, item.attendance]])}><Download size={16} />Report</button></div><div className="student-score-grid"><article><span>Average score</span><strong>{item.score}<small>/100</small></strong></article><article><span>Attendance</span><strong>{item.attendance}<small>%</small></strong></article><article><span>Project status</span><strong>{item.klass === 'Not assigned' ? 'Unassigned' : 'On track'}</strong></article></div><div className="detail-section"><header><div><span className="surface-eyebrow">Learning record</span><h3>Sample session feedback</h3></div></header>{item.klass === 'Not assigned' ? <p className="detail-muted">No feedback recorded.</p> : [['Research foundations', 90], ['Prototype review', 87], ['Project presentation', 94]].map(([title, score], index) => <article className="feedback-row" key={String(title)}><b>{String(index + 1).padStart(2, '0')}</b><div><h4>{title}</h4><p>Shows clear progress, asks thoughtful questions, and responds well to feedback from peers and coaches.</p></div><strong>{score}<small>/100</small></strong></article>)}</div></>;
}

function InstitutionDetail({ item, klasses }: { item: (typeof institutions)[number]; klasses: KlassRecord[] }) {
  const active = klasses.filter((klass) => klass.school === item.name);
  return <><div className="institution-detail-head"><div className="institution-logo">{item.logo ? <Image src={item.logo} alt={`${item.name} logo`} fill sizes="140px" /> : <span>{initials(item.name)}</span>}</div><div><span>Partner institution</span><h2>{item.name}</h2><p>{item.city}, Indonesia</p></div><div className="profile-stats"><strong>{item.classes}<small>Active Klass</small></strong><strong>{item.students}<small>Students</small></strong></div></div><div className="detail-copy"><span className="surface-eyebrow">Partnership overview</span><h3>Learning built around student agency.</h3><p>{item.about}</p></div><div className="detail-section"><header><div><span className="surface-eyebrow">Programs</span><h3>Active Klass</h3></div></header>{active.length ? active.map((klass) => <article className="compact-klass" key={klass.id}><div><Image src={klass.image} alt="" fill sizes="100px" /></div><span><strong>{klass.title}</strong><small>{klass.students} students / {klass.mode}</small></span></article>) : <p className="detail-muted">No active Klass assigned.</p>}</div></>;
}

function InquiryDetail({ item, onContacted }: { item: (typeof inquiries)[number]; onContacted: () => void }) {
  return <><div className="inquiry-detail-head"><span>{initials(item.name)}</span><div><small>{item.type}</small><h2>{item.name}</h2><a href={`mailto:${item.email}`}>{item.email}</a></div><StatusChip status={item.status} /></div><div className="detail-copy"><span className="surface-eyebrow">Message received {item.date}</span><h3>A new conversation to follow up.</h3><p>{item.message}</p></div><div className="inquiry-actions"><a className="admin-primary-action" href={`mailto:${item.email}`}><Mail size={16} />Reply by email</a><button className="admin-secondary-action" type="button" disabled={item.status !== 'New'} onClick={onContacted}><Check size={16} />{item.status === 'New' ? 'Mark contacted' : item.status}</button></div></>;
}

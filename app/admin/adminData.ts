export type KlassMode = 'Online' | 'Onsite' | 'Hybrid';

export type KlassRecord = {
  id: string;
  title: string;
  category: string;
  school: string;
  mode: KlassMode;
  image: string;
  coaches: string[];
  students: number;
  schedule: string;
  description: string;
};

export type CoachRecord = {
  id: string;
  name: string;
  specialty: string;
  level: 'Lead Coach' | 'Coach';
  image: string;
  email: string;
  classes: number;
  students: number;
  bio: string;
};

export type StudentRecord = {
  id: string;
  name: string;
  school: string;
  grade: string;
  klass: string;
  score: number;
  attendance: number;
};

export const klasses: KlassRecord[] = [
  {
    id: 'biotech-10',
    title: 'Biotechnology Grade 10',
    category: 'Biotechnology',
    school: 'Xin Zhong School',
    mode: 'Onsite',
    image: '/klass/biotechnology-xin-zhong.webp',
    coaches: ['Rahayu Widyawati', 'Daniel Richard'],
    students: 24,
    schedule: 'Mon & Wed, 10:00 - 11:30',
    description: 'A project-based introduction to biotechnology, laboratory practice, and responsible scientific inquiry for secondary students.',
  },
  {
    id: 'steamaker-cikal',
    title: 'STEAMaker',
    category: 'Innovation & Creativity',
    school: 'Sekolah Cikal',
    mode: 'Hybrid',
    image: '/klass/steamaker-cikal.webp',
    coaches: ['Wahyu Wido', 'Angelina Hartono'],
    students: 18,
    schedule: 'Tue, 13:00 - 15:00',
    description: 'Students investigate real challenges, prototype useful ideas, and communicate their design decisions through collaborative STEAM projects.',
  },
  {
    id: 'innovation-gloria',
    title: 'Innovation Klass',
    category: 'Innovation & Creativity',
    school: 'Gloria School',
    mode: 'Onsite',
    image: '/klass/innovation-gloria.webp',
    coaches: ['Daniel Richard'],
    students: 20,
    schedule: 'Fri, 09:00 - 11:00',
    description: 'An applied creativity program where students turn observations into ideas, prototypes, and presentations with measurable community value.',
  },
  {
    id: 'coding',
    title: 'Coding Fundamentals',
    category: 'Digital Technology',
    school: 'KRYAcademia Online',
    mode: 'Online',
    image: '/klass/digitechnology-coding.webp',
    coaches: ['Gabriel Ryan'],
    students: 16,
    schedule: 'Sat, 10:00 - 12:00',
    description: 'A hands-on coding class focused on computational thinking, clear problem solving, and building small digital products with confidence.',
  },
  {
    id: 'ar-storytelling',
    title: 'AR Storytelling',
    category: 'Digital Technology',
    school: 'KRYAcademia Online',
    mode: 'Online',
    image: '/klass/digitechnology-ar-storytelling.webp',
    coaches: ['Jessica Angelina'],
    students: 14,
    schedule: 'Sat, 13:00 - 15:00',
    description: 'Students combine narrative structure, visual design, and augmented reality to produce an interactive story experience.',
  },
  {
    id: 'digital-animation',
    title: 'Digital Animation',
    category: 'Creative Technology',
    school: 'KRYAcademia Online',
    mode: 'Online',
    image: '/klass/digital-animation.webp',
    coaches: ['Angelina Hartono'],
    students: 21,
    schedule: 'Sun, 10:00 - 12:00',
    description: 'A visual storytelling studio covering character, movement, timing, and the production of a short animated scene.',
  },
];

export const coaches: CoachRecord[] = [
  { id: 'rahayu', name: 'Rahayu Widyawati', specialty: 'Biotechnology', level: 'Lead Coach', image: '/coaches/rahayu-widyawati.jpg', email: 'rahayu@example.com', classes: 4, students: 82, bio: 'Guides students through scientific investigation, evidence-based reasoning, and responsible biotechnology projects.' },
  { id: 'daniel', name: 'Daniel Richard', specialty: 'Innovation', level: 'Lead Coach', image: '/coaches/daniel-richard.jpg', email: 'daniel@example.com', classes: 3, students: 64, bio: 'Helps young makers move from a strong question to a tested idea through practical, collaborative learning.' },
  { id: 'wahyu', name: 'Wahyu Wido', specialty: 'STEAMaker', level: 'Coach', image: '/coaches/wahyu-wido.jpg', email: 'wahyu@example.com', classes: 3, students: 58, bio: 'Creates active STEAM experiences where students design, build, reflect, and confidently present their work.' },
  { id: 'angelina', name: 'Angelina Hartono', specialty: 'Creative Technology', level: 'Coach', image: '/coaches/angelina-hartono.jpg', email: 'angelina@example.com', classes: 2, students: 39, bio: 'Connects visual communication and digital tools to help students shape ideas into thoughtful creative outcomes.' },
  { id: 'gabriel', name: 'Gabriel Ryan', specialty: 'Coding', level: 'Coach', image: '/coaches/gabriel-ryan.jpg', email: 'gabriel@example.com', classes: 3, students: 47, bio: 'Teaches coding through small, useful projects and encourages students to explain how and why their solutions work.' },
  { id: 'jessica', name: 'Jessica Angelina', specialty: 'AR Storytelling', level: 'Coach', image: '/coaches/jessica-angelina.jpg', email: 'jessica@example.com', classes: 2, students: 31, bio: 'Supports students in combining storytelling, interaction, and emerging media into experiences with a clear audience.' },
];

export const students: StudentRecord[] = [
  { id: 'alicia', name: 'Alicia Tan', school: 'Xin Zhong School', grade: 'Grade 10', klass: 'Biotechnology Grade 10', score: 91, attendance: 98 },
  { id: 'bima', name: 'Bima Wijaya', school: 'Sekolah Cikal', grade: 'Grade 9', klass: 'STEAMaker', score: 88, attendance: 94 },
  { id: 'catherine', name: 'Catherine Lim', school: 'Gloria School', grade: 'Grade 11', klass: 'Innovation Klass', score: 93, attendance: 96 },
  { id: 'darren', name: 'Darren Santoso', school: 'Xin Zhong School', grade: 'Grade 10', klass: 'Biotechnology Grade 10', score: 86, attendance: 92 },
  { id: 'elena', name: 'Elena Hartono', school: 'Sekolah Cikal', grade: 'Grade 8', klass: 'Coding Fundamentals', score: 90, attendance: 100 },
  { id: 'farhan', name: 'Farhan Akbar', school: 'Gloria School', grade: 'Grade 9', klass: 'Digital Animation', score: 84, attendance: 91 },
];

export const institutions = [
  { id: 'xin-zhong', name: 'Xin Zhong School', city: 'Surabaya', classes: 1, students: 24, logo: '/partners/4.jpg', about: 'A learning partner collaborating with KRYAcademia on biotechnology and innovation experiences for secondary students.' },
  { id: 'cikal', name: 'Sekolah Cikal', city: 'Jakarta', classes: 1, students: 18, logo: '', about: 'A partner institution bringing project-based STEAM learning into interdisciplinary student journeys.' },
  { id: 'gloria', name: 'Gloria School', city: 'Surabaya', classes: 1, students: 20, logo: '/partners/6.jpg', about: 'A partner school supporting creative problem solving, prototyping, and student-led innovation.' },
  { id: 'sampoerna', name: 'Sampoerna Academy', city: 'Jakarta', classes: 0, students: 0, logo: '/partners/81.png', about: 'A partner institution connecting digital literacy with meaningful project outcomes.' },
];

export const approvals = [
  { id: 'apr-1', owner: 'Rahayu Widyawati', type: 'Syllabus', detail: 'Biotechnology semester outline', due: 'Today, 17:00', status: 'Pending' },
  { id: 'apr-2', owner: 'Wahyu Wido', type: 'Purchase Request', detail: 'STEAMaker prototype materials', due: 'Tomorrow, 12:00', status: 'Submitted' },
  { id: 'apr-3', owner: 'Gabriel Ryan', type: 'Lesson Plan', detail: 'Coding project sprint', due: '08 Oct 2026', status: 'Approved' },
  { id: 'apr-4', owner: 'Jessica Angelina', type: 'Slides', detail: 'AR narrative workshop', due: '10 Oct 2026', status: 'Needs revision' },
];

export const inquiries = [
  { id: 'inq-1', name: 'SMA Petra 12', email: 'partnership@example.com', type: 'School Partnership', date: 'Today, 09:24', status: 'New', message: 'We would like to discuss an onsite innovation program for Grade 10.' },
  { id: 'inq-2', name: 'Ibu Kartini', email: 'kartini@example.com', type: 'Parent Inquiry', date: 'Yesterday', status: 'Contacted', message: 'Could you share the next online coding class schedule?' },
  { id: 'inq-3', name: 'Rudi Hermawan', email: 'rudi@example.com', type: 'General', date: '03 Oct 2026', status: 'Resolved', message: 'Thank you, the information has been received.' },
  { id: 'inq-4', name: 'Maria Chen', email: 'maria@example.com', type: 'Klass Registration', date: '02 Oct 2026', status: 'New', message: 'I am interested in Digital Animation for my child.' },
];

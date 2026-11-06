'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'id' | 'zh';

const messages = {
  en: {
    nav: { home: 'Home', klass: 'Klass', programs: 'Programs', agenda: 'Agenda', activities: 'Activities', partners: 'Partner Schools', updates: 'Updates', faq: 'FAQ', contact: 'Contact' },
    hero: { eyebrow: 'KRYAcademia', first: 'The 21st', accent: 'Education', last: 'Center', copy: 'KRYAcademia creates innovative, project-based learning experiences that empower young people to think critically, create confidently, and make a meaningful impact.', klass: 'Explore Klass', learn: 'See How We Learn', upcoming: 'Upcoming Agenda' },
    stats: { students: 'Students', partners: 'Partner Institution', programs: 'Programs', klass: 'Klass' },
    klass: { eyebrow: 'KRYAcademia Klass', title: 'Discover Your Next Klass', copy: 'Where creativity, technology, innovation, and practical learning meet - one meaningful project at a time.', allModes: 'All modes', online: 'Online', onsite: 'Onsite', all: 'All', innovation: 'Innovation & Creativity', technology: 'Technology', art: 'Art & Language', count: 'Klass', status: 'Mode and schedule subject to confirmation.', explore: 'View Klass Details', empty: 'No Klass listed for this combination yet.', viewAll: 'View all Klass', details: 'Klass details', availability: 'Availability', teachingTeam: 'Teaching team', teacherNote: 'The final coach assignment is confirmed with the selected schedule and delivery mode.', ask: 'Ask About This Klass', documentation: 'Klass documentation', previous: 'Previous photo', next: 'Next photo', close: 'Close Klass details' },
    why: { label: 'Learning with purpose', title: 'Why KRYAcademia', intro: 'Learning should prepare young people to shape the world, not simply fit into it. Through creative, project-based experiences, students turn curiosity into skills they can use beyond the classroom.', overlay: 'Real projects.', overlayAccent: 'Meaningful learning.', backgroundLabel: '01 / Our background', backgroundTitle: 'Curiosity becomes capability.', background: 'Young people need opportunities to connect what they learn with the world around them. KRYAcademia brings technology, art, and hands-on making together, using real challenges to build practical skills and a sense of purpose.', visionLabel: '02 / Our vision', visionTitle: 'A future made by doing.', vision: 'We envision thoughtful, confident creators who can contribute to a sustainable future. Students learn to question, imagine possibilities, and consider how their ideas affect other people and the environment.', missionLabel: '03 / Our mission', missionTitle: 'Learn, make, and share.', mission: 'Our mission is to develop critical thinking, creativity, confidence, and collaboration through project-based learning. Students explore a challenge, build and test their ideas, improve their work, and share what they discover.', sdgs: 'KRYAcademia connects creative, project-based learning with the SDGs to inspire a more sustainable future.' },
    programs: { eyebrow: 'Programs', title: 'Learning Experiences for Every Journey', copy: 'Flexible formats for families, schools, and institutions - designed around active learning and purposeful outcomes.', details: 'Program details', experience: 'What participants experience', experienceCopy: 'Every program combines guided exploration, hands-on creation, teamwork, and reflection. Activities can be adjusted to suit the participants age, learning goals, available time, and school context.', designed: 'Designed for', format: 'Format', request: 'Request This Program', customTitle: 'Have something different in mind?', customCopy: 'We can design custom learning experiences with schools and institutions.', customAction: 'Start a conversation' },
    agenda: { eyebrow: 'Agenda', title: "What's Happening at KRYAcademia", copy: 'Explore upcoming workshops, open classes, exhibitions, and learning events.', sample: 'Sample agenda', previousMonth: 'Previous month', nextMonth: 'Next month', choose: 'Choose a date', hasEvents: 'has events', today: 'Today', filter: 'Filter agenda', all: 'All', upcoming: 'Upcoming', past: 'Past', noEventsDate: 'No events scheduled for this date.', noEventsMonth: 'events in this month.', sampleEvent: 'sample event', sampleEvents: 'sample events' },
    activities: { eyebrow: 'Inside KRYAcademia', title: 'Our Activities', copy: 'Discover inspiring moments of creativity, collaboration, and meaningful learning at KRYAcademia.' },
    partners: { eyebrow: 'Together, further', title: 'Partner Schools', copy: 'We collaborate with schools to create innovative and sustainable learning experiences shaped around each community.', action: 'Partner With KRYAcademia', aria: 'KRYAcademia partner schools' },
    coaches: { eyebrow: 'Learning team', title: 'Meet the Coaches', copy: 'Meet the education team supporting thoughtful, hands-on learning experiences at KRYAcademia.', focus: 'Focus', role: (specialty: string) => `${specialty} Coach`, description: (specialty: string) => `Guides practical ${specialty} projects through active, collaborative learning.`, note: 'Coach assignments for each Klass are confirmed according to topic, schedule, and delivery mode.' },
    updates: { eyebrow: 'Latest stories', title: 'KRYAcademia Updates', copy: 'News, opportunities, and learning moments from the KRYAcademia community.', previous: 'Previous updates', next: 'Next updates', read: 'Read update' },
    faq: { eyebrow: 'Good to know', title: 'Questions,', accent: 'answered.', copy: "Can't find what you need? Our team is ready to help.", ask: 'Ask us directly', items: [
      ['Who can join KRYAcademia?', 'Learning experiences are designed for elementary through high-school students, with the appropriate level varying by Klass or program.'],
      ['Are learning experiences available online and onsite?', 'Online and onsite options vary by Klass. Please confirm your preferred mode and schedule with our team.'],
      ['Where do onsite programs take place?', 'Locations vary by program and school partnership. The team confirms venue details before registration.'],
      ['Can a school design a custom program?', 'Yes. We work with schools to shape programs around learning goals, age groups, schedules, and context.'],
      ['How do I register for a Klass?', 'Choose the Klass you are interested in and send an inquiry. Our team will follow up with availability and guidance.'],
      ['How can I contact the team?', 'Use the inquiry form, email aha@krya.global, or WhatsApp +62 851-1121-2362.'],
    ] },
    contact: { eyebrow: "Let's talk", title: 'Get in Touch', copy: 'Tell us what you are looking for, and our team will help you find the right learning experience or collaboration opportunity.', cleo: 'Cleo', name: 'Full Name', email: 'Email Address', phone: 'WhatsApp Number', place: 'City / Country', type: 'Inquiry Type', institution: 'Institution', institutionName: 'Institution Name', institutionPlaceholder: 'School or institution name', changeInstitution: 'Change institution type', klass: 'Klass of Interest', mode: 'Preferred Mode', program: 'Program of Interest', schoolLevel: 'School Level', workshop: 'Workshop Topic or Request', event: 'Event of Interest', specify: 'Please Specify', message: 'Message', consent: 'I agree that KRYAcademia may use this information to respond.', required: 'Please enter a valid value.', select: 'Select one', send: 'Send Inquiry', sending: 'Sending...', note: 'Your inquiry will be shared with the KRYAcademia team for follow-up.', success: 'Inquiry received. Our team will follow up with you.', validation: 'Please check the highlighted fields. Use a valid email and WhatsApp number.', unavailable: 'Could not send your inquiry. Your entries are unchanged; please retry.', rateLimit: 'Too many inquiries. Please wait 15 minutes before trying again.', parent: 'Parent', nonInstitution: 'Non-institution', customProgram: 'Custom Program', other: 'Other' },
    footer: { copy: 'Creative, project-based learning that equips young people to make meaningful impact.', explore: 'Explore', discover: 'Discover', online: 'Online Klass', onsite: 'Onsite Klass', portal: 'Teacher & Admin Portal', visit: 'Visit us', back: 'Back to top', rights: 'All rights reserved.' },
  },
  id: {
    nav: { home: 'Beranda', klass: 'Klass', programs: 'Program', agenda: 'Agenda', activities: 'Aktivitas', partners: 'Sekolah Mitra', updates: 'Update', faq: 'FAQ', contact: 'Kontak' },
    hero: { eyebrow: 'KRYAcademia', first: 'Pusat', accent: 'Pendidikan', last: 'Abad ke-21', copy: 'KRYAcademia menghadirkan pengalaman belajar inovatif berbasis proyek yang membantu generasi muda berpikir kritis, berkarya dengan percaya diri, dan menciptakan dampak bermakna.', klass: 'Jelajahi Klass', learn: 'Lihat Cara Kami Belajar', upcoming: 'Agenda Mendatang' },
    stats: { students: 'Siswa', partners: 'Institusi Mitra', programs: 'Program', klass: 'Klass' },
    klass: { eyebrow: 'KRYAcademia Klass', title: 'Temukan Klass Berikutnya', copy: 'Tempat kreativitas, teknologi, inovasi, dan pembelajaran praktis bertemu dalam proyek yang bermakna.', allModes: 'Semua mode', online: 'Online', onsite: 'Onsite', all: 'Semua', innovation: 'Inovasi & Kreativitas', technology: 'Teknologi', art: 'Seni & Bahasa', count: 'Klass', status: 'Mode dan jadwal perlu dikonfirmasi.', explore: 'Lihat Detail Klass', empty: 'Belum ada Klass untuk kombinasi ini.', viewAll: 'Lihat semua Klass', details: 'Detail Klass', availability: 'Ketersediaan', teachingTeam: 'Tim pengajar', teacherNote: 'Penugasan coach final dikonfirmasi sesuai jadwal dan mode belajar yang dipilih.', ask: 'Tanyakan Klass Ini', documentation: 'Dokumentasi Klass', previous: 'Foto sebelumnya', next: 'Foto berikutnya', close: 'Tutup detail Klass' },
    why: { label: 'Belajar dengan tujuan', title: 'Mengapa KRYAcademia', intro: 'Pembelajaran perlu mempersiapkan generasi muda untuk membentuk dunia, bukan sekadar menyesuaikan diri. Melalui pengalaman kreatif berbasis proyek, rasa ingin tahu berkembang menjadi keterampilan yang berguna di luar kelas.', overlay: 'Proyek nyata.', overlayAccent: 'Belajar bermakna.', backgroundLabel: '01 / Latar belakang', backgroundTitle: 'Rasa ingin tahu menjadi kemampuan.', background: 'Generasi muda membutuhkan kesempatan untuk menghubungkan pelajaran dengan dunia di sekitar mereka. KRYAcademia memadukan teknologi, seni, dan kegiatan membuat untuk membangun keterampilan praktis dan tujuan.', visionLabel: '02 / Visi kami', visionTitle: 'Masa depan dibentuk dengan berkarya.', vision: 'Kami membayangkan kreator yang berpikir matang, percaya diri, dan mampu berkontribusi pada masa depan berkelanjutan. Siswa belajar bertanya, membayangkan kemungkinan, serta memahami dampak ide mereka.', missionLabel: '03 / Misi kami', missionTitle: 'Belajar, membuat, dan berbagi.', mission: 'Misi kami adalah mengembangkan pemikiran kritis, kreativitas, kepercayaan diri, dan kolaborasi melalui pembelajaran berbasis proyek.', sdgs: 'KRYAcademia menghubungkan pembelajaran kreatif berbasis proyek dengan SDGs untuk menginspirasi masa depan yang lebih berkelanjutan.' },
    programs: { eyebrow: 'Program', title: 'Pengalaman Belajar untuk Setiap Perjalanan', copy: 'Format fleksibel bagi keluarga, sekolah, dan institusi yang dirancang untuk pembelajaran aktif dan hasil bermakna.', details: 'Detail program', experience: 'Pengalaman peserta', experienceCopy: 'Setiap program menggabungkan eksplorasi terarah, praktik membuat, kerja tim, dan refleksi. Aktivitas dapat disesuaikan dengan usia, tujuan belajar, waktu, dan konteks sekolah.', designed: 'Dirancang untuk', format: 'Format', request: 'Ajukan Program Ini', customTitle: 'Punya kebutuhan yang berbeda?', customCopy: 'Kami dapat merancang pengalaman belajar khusus bersama sekolah dan institusi.', customAction: 'Mulai percakapan' },
    agenda: { eyebrow: 'Agenda', title: 'Kegiatan di KRYAcademia', copy: 'Jelajahi workshop, open class, pameran, dan kegiatan belajar mendatang.', sample: 'Contoh agenda', previousMonth: 'Bulan sebelumnya', nextMonth: 'Bulan berikutnya', choose: 'Pilih tanggal', hasEvents: 'memiliki acara', today: 'Hari ini', filter: 'Filter agenda', all: 'Semua', upcoming: 'Mendatang', past: 'Selesai', noEventsDate: 'Tidak ada acara pada tanggal ini.', noEventsMonth: 'acara pada bulan ini.', sampleEvent: 'contoh acara', sampleEvents: 'contoh acara' },
    activities: { eyebrow: 'Di dalam KRYAcademia', title: 'Aktivitas Kami', copy: 'Temukan momen kreativitas, kolaborasi, dan pembelajaran bermakna di KRYAcademia.' },
    partners: { eyebrow: 'Bersama melangkah lebih jauh', title: 'Sekolah Mitra', copy: 'Kami berkolaborasi dengan sekolah untuk menciptakan pengalaman belajar inovatif dan berkelanjutan sesuai kebutuhan setiap komunitas.', action: 'Bermitra dengan KRYAcademia', aria: 'Sekolah mitra KRYAcademia' },
    coaches: { eyebrow: 'Tim pembelajaran', title: 'Kenali Para Coach', copy: 'Kenali tim pendidikan yang mendukung pengalaman belajar aktif dan penuh perhatian di KRYAcademia.', focus: 'Fokus', role: (specialty: string) => `Coach ${specialty}`, description: (specialty: string) => `Mendampingi proyek praktis ${specialty} melalui pembelajaran aktif dan kolaboratif.`, note: 'Penugasan coach untuk setiap Klass dikonfirmasi berdasarkan topik, jadwal, dan mode belajar.' },
    updates: { eyebrow: 'Cerita terbaru', title: 'Update KRYAcademia', copy: 'Berita, peluang, dan momen belajar dari komunitas KRYAcademia.', previous: 'Update sebelumnya', next: 'Update berikutnya', read: 'Baca update' },
    faq: { eyebrow: 'Informasi penting', title: 'Pertanyaan,', accent: 'terjawab.', copy: 'Belum menemukan yang dicari? Tim kami siap membantu.', ask: 'Tanyakan langsung', items: [
      ['Siapa yang dapat mengikuti KRYAcademia?', 'Pengalaman belajar dirancang untuk siswa sekolah dasar hingga menengah, dengan tingkat yang disesuaikan pada setiap Klass atau program.'],
      ['Apakah tersedia pembelajaran online dan onsite?', 'Pilihan online dan onsite berbeda pada setiap Klass. Konfirmasikan mode dan jadwal pilihan Anda kepada tim kami.'],
      ['Di mana program onsite dilaksanakan?', 'Lokasi berbeda sesuai program dan kemitraan sekolah. Tim akan mengonfirmasi lokasi sebelum pendaftaran.'],
      ['Dapatkah sekolah merancang program khusus?', 'Ya. Kami bekerja bersama sekolah untuk menyesuaikan program dengan tujuan belajar, kelompok usia, jadwal, dan konteks.'],
      ['Bagaimana cara mendaftar Klass?', 'Pilih Klass yang diminati dan kirim inquiry. Tim kami akan menindaklanjuti ketersediaan dan panduan berikutnya.'],
      ['Bagaimana cara menghubungi tim?', 'Gunakan inquiry form, email aha@krya.global, atau WhatsApp +62 851-1121-2362.'],
    ] },
    contact: { eyebrow: 'Mari berbicara', title: 'Hubungi Kami', copy: 'Ceritakan kebutuhan Anda, dan tim kami akan membantu menemukan pengalaman belajar atau peluang kolaborasi yang tepat.', cleo: 'Cleo', name: 'Nama Lengkap', email: 'Alamat Email', phone: 'Nomor WhatsApp', place: 'Kota / Negara', type: 'Jenis Inquiry', institution: 'Institusi', institutionName: 'Nama Institusi', institutionPlaceholder: 'Nama sekolah atau institusi', changeInstitution: 'Ubah jenis institusi', klass: 'Klass yang Diminati', mode: 'Mode Pilihan', program: 'Program yang Diminati', schoolLevel: 'Jenjang Sekolah', workshop: 'Topik atau Permintaan Workshop', event: 'Acara yang Diminati', specify: 'Jelaskan Kebutuhan', message: 'Pesan', consent: 'Saya menyetujui KRYAcademia menggunakan informasi ini untuk merespons.', required: 'Isi bagian ini dengan nilai yang valid.', select: 'Pilih satu', send: 'Kirim Inquiry', sending: 'Mengirim...', note: 'Inquiry Anda akan diterima tim KRYAcademia untuk ditindaklanjuti.', success: 'Inquiry berhasil diterima. Tim kami akan menghubungi Anda.', validation: 'Periksa bagian yang ditandai. Gunakan email dan nomor WhatsApp yang valid.', unavailable: 'Inquiry belum terkirim. Isian Anda tetap tersimpan di form; silakan coba lagi.', rateLimit: 'Terlalu banyak inquiry. Tunggu 15 menit sebelum mencoba lagi.', parent: 'Orang tua', nonInstitution: 'Non-institusi', customProgram: 'Program Khusus', other: 'Lainnya' },
    footer: { copy: 'Pembelajaran kreatif berbasis proyek yang membekali generasi muda untuk menciptakan dampak bermakna.', explore: 'Jelajahi', discover: 'Temukan', online: 'Klass Online', onsite: 'Klass Onsite', portal: 'Portal Guru & Admin', visit: 'Kunjungi kami', back: 'Kembali ke atas', rights: 'Hak cipta dilindungi.' },
  },
  zh: {
    nav: { home: '首页', klass: '课程', programs: '项目', agenda: '日程', activities: '活动', partners: '合作学校', updates: '动态', faq: '常见问题', contact: '联系我们' },
    hero: { eyebrow: 'KRYAcademia', first: '21世纪', accent: '教育', last: '中心', copy: 'KRYAcademia 提供创新的项目式学习体验，帮助青少年培养批判思维、自信创造并带来有意义的影响。', klass: '探索课程', learn: '了解学习方式', upcoming: '近期日程' },
    stats: { students: '学生', partners: '合作机构', programs: '项目', klass: '课程' },
    klass: { eyebrow: 'KRYAcademia 课程', title: '发现你的下一门课程', copy: '让创意、科技、创新与实践学习在一个有意义的项目中相遇。', allModes: '全部模式', online: '线上', onsite: '线下', all: '全部', innovation: '创新与创意', technology: '科技', art: '艺术与语言', count: '课程', status: '模式与时间需进一步确认。', explore: '查看课程详情', empty: '此组合暂无课程。', viewAll: '查看全部课程', details: '课程详情', availability: '授课模式', teachingTeam: '教学团队', teacherNote: '最终教练安排将根据所选时间与授课模式确认。', ask: '咨询这门课程', documentation: '课程记录', previous: '上一张照片', next: '下一张照片', close: '关闭课程详情' },
    why: { label: '有目标地学习', title: '为什么选择 KRYAcademia', intro: '学习应帮助青少年塑造世界，而不仅是适应世界。通过创意项目式体验，学生把好奇心转化为课堂之外也能使用的能力。', overlay: '真实项目。', overlayAccent: '有意义的学习。', backgroundLabel: '01 / 我们的背景', backgroundTitle: '让好奇心成为能力。', background: '青少年需要把所学知识与周围世界连接起来。KRYAcademia 融合科技、艺术和动手实践，通过真实挑战培养实用能力与目标感。', visionLabel: '02 / 我们的愿景', visionTitle: '在实践中创造未来。', vision: '我们希望培养有思考力、自信并能为可持续未来作出贡献的创造者。学生学习提问、想象可能，并思考自己的创意如何影响他人与环境。', missionLabel: '03 / 我们的使命', missionTitle: '学习、创造、分享。', mission: '我们通过项目式学习培养批判思维、创造力、自信与协作能力。', sdgs: 'KRYAcademia 将创意项目式学习与可持续发展目标相结合，启发更可持续的未来。' },
    programs: { eyebrow: '项目', title: '适合每段成长旅程的学习体验', copy: '为家庭、学校和机构提供灵活形式，专注主动学习与有意义的成果。', details: '项目详情', experience: '参与者体验', experienceCopy: '每个项目都结合引导探索、动手创造、团队协作与反思，并可根据年龄、学习目标、时间和学校情境进行调整。', designed: '适合对象', format: '形式', request: '咨询此项目', customTitle: '有不同的需求？', customCopy: '我们可以与学校和机构共同设计定制学习体验。', customAction: '开始沟通' },
    agenda: { eyebrow: '日程', title: 'KRYAcademia 近期活动', copy: '探索即将举行的工作坊、公开课、展览和学习活动。', sample: '示例日程', previousMonth: '上个月', nextMonth: '下个月', choose: '选择日期', hasEvents: '有活动', today: '今天', filter: '筛选日程', all: '全部', upcoming: '即将举行', past: '已结束', noEventsDate: '该日期暂无活动。', noEventsMonth: '本月活动。', sampleEvent: '个示例活动', sampleEvents: '个示例活动' },
    activities: { eyebrow: '走进 KRYAcademia', title: '我们的活动', copy: '发现 KRYAcademia 中充满创意、合作与有意义学习的精彩时刻。' },
    partners: { eyebrow: '携手走得更远', title: '合作学校', copy: '我们与学校合作，根据每个社群的需求打造创新且可持续的学习体验。', action: '与 KRYAcademia 合作', aria: 'KRYAcademia 合作学校' },
    coaches: { eyebrow: '学习团队', title: '认识我们的教练', copy: '认识支持 KRYAcademia 用心开展动手学习体验的教育团队。', focus: '专长', role: (specialty: string) => `${specialty} 教练`, description: (specialty: string) => `通过主动协作的学习方式，指导 ${specialty} 实践项目。`, note: '每门课程的教练安排将根据主题、时间和授课模式确认。' },
    updates: { eyebrow: '最新故事', title: 'KRYAcademia 动态', copy: '来自 KRYAcademia 社群的新闻、机会与学习时刻。', previous: '上一组动态', next: '下一组动态', read: '阅读动态' },
    faq: { eyebrow: '实用信息', title: '问题，', accent: '都有答案。', copy: '没有找到需要的信息？我们的团队随时提供帮助。', ask: '直接咨询我们', items: [
      ['谁可以参加 KRYAcademia？', '学习体验面向小学至高中学生，每门课程或项目会根据年龄设置合适的难度。'],
      ['是否提供线上和线下学习？', '线上和线下选项因课程而异，请向团队确认偏好模式与时间。'],
      ['线下项目在哪里举行？', '地点根据项目与学校合作安排而定，团队会在报名之前确认。'],
      ['学校可以定制项目吗？', '可以。我们会根据学习目标、年龄、时间和学校情境共同设计项目。'],
      ['如何报名课程？', '选择感兴趣的课程并发送咨询，团队会回复名额与后续指引。'],
      ['如何联系团队？', '可使用咨询表单、发送邮件至 aha@krya.global，或 WhatsApp 联系 +62 851-1121-2362。'],
    ] },
    contact: { eyebrow: '欢迎交流', title: '联系我们', copy: '告诉我们您的需求，团队将帮助您找到合适的学习体验或合作机会。', cleo: 'Cleo', name: '姓名', email: '电子邮箱', phone: 'WhatsApp 号码', place: '城市 / 国家', type: '咨询类型', institution: '身份', institutionName: '机构名称', institutionPlaceholder: '学校或机构名称', changeInstitution: '更改身份类型', klass: '感兴趣的课程', mode: '偏好模式', program: '感兴趣的项目', schoolLevel: '学校阶段', workshop: '工作坊主题或需求', event: '感兴趣的活动', specify: '请说明', message: '留言', consent: '我同意 KRYAcademia 使用这些信息回复我的咨询。', required: '请输入有效内容。', select: '请选择', send: '发送咨询', sending: '发送中...', note: '您的咨询将提交给 KRYAcademia 团队跟进。', success: '咨询已收到，我们的团队将与您联系。', validation: '请检查标记的字段，输入有效的邮箱和 WhatsApp 号码。', unavailable: '咨询未能发送，填写的内容已保留，请重试。', rateLimit: '咨询次数过多，请等待15分钟后重试。', parent: '家长', nonInstitution: '非机构', customProgram: '定制项目', other: '其他' },
    footer: { copy: '通过创意项目式学习，帮助青少年创造有意义的影响。', explore: '探索', discover: '发现', online: '线上课程', onsite: '线下课程', portal: '教师与管理门户', visit: '访问我们', back: '返回顶部', rights: '版权所有。' },
  },
} as const;

const localizedText: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  id: {
    'Explore everyday challenges through hands-on STEAM projects and upcycling.': 'Jelajahi tantangan sehari-hari melalui proyek STEAM dan upcycling secara langsung.',
    'Develop creative solutions to real-world problems through practical projects.': 'Kembangkan solusi kreatif untuk masalah nyata melalui proyek praktis.',
    'Discover thematic STEAM activities with a hands-on learning kit.': 'Temukan aktivitas STEAM tematik melalui perangkat belajar praktis.',
    'Connect everyday science with curiosity, teamwork, and environmental awareness.': 'Hubungkan sains sehari-hari dengan rasa ingin tahu, kerja tim, dan kepedulian lingkungan.',
    'Create purposeful digital projects while developing coding and problem-solving skills.': 'Buat proyek digital bermakna sambil mengembangkan coding dan pemecahan masalah.',
    'Explore coding, visual design, and three-dimensional game creation.': 'Jelajahi coding, desain visual, dan pembuatan gim tiga dimensi.',
    'Create augmented-reality stories that connect digital and physical worlds.': 'Buat cerita augmented reality yang menghubungkan dunia digital dan fisik.',
    'Develop animation fundamentals through structured, creative practice.': 'Pelajari dasar animasi melalui latihan kreatif yang terstruktur.',
    'Draw characters and express original stories through anime-inspired art.': 'Gambar karakter dan ungkapkan cerita orisinal melalui seni bergaya anime.',
    'Explore creativity and aesthetic awareness through visual and digital arts.': 'Jelajahi kreativitas dan kepekaan estetika melalui seni visual dan digital.',
    'Students · School break': 'Siswa · Liburan sekolah',
    'Students · Weekends': 'Siswa · Akhir pekan',
    'Schools · Students': 'Sekolah · Siswa',
    'School groups': 'Kelompok sekolah',
    'Online / Onsite': 'Online / Onsite',
    'At partner schools': 'Di sekolah mitra',
    Onsite: 'Onsite',
    'Creative project-based experiences that turn school holidays into meaningful time for discovery and making. Students explore a real-world theme, develop an original idea, build a practical outcome, and share what they learn with confidence.': 'Pengalaman kreatif berbasis proyek yang menjadikan liburan sekolah sebagai waktu bermakna untuk bereksplorasi dan berkarya.',
    'Hands-on STEAM projects that build curiosity, teamwork, confidence, and practical skills at a comfortable weekend pace. Each session invites students to experiment, improve their ideas, and celebrate progress through a tangible project.': 'Proyek STEAM praktis yang membangun rasa ingin tahu, kerja tim, kepercayaan diri, dan keterampilan pada ritme akhir pekan yang nyaman.',
    'A school-developed learning program that enriches the curriculum through creativity, technology, and innovation. KRYAcademia works with the school to shape relevant themes, learning outcomes, schedules, and projects for its students.': 'Program yang dikembangkan bersama sekolah untuk memperkaya kurikulum melalui kreativitas, teknologi, dan inovasi.',
    'Field studies and guided experiences that connect classroom knowledge with real-world contexts. Students observe, ask questions, collect insights, and turn their discoveries into thoughtful reflections or collaborative project outcomes.': 'Studi lapangan dan pengalaman terarah yang menghubungkan pengetahuan kelas dengan konteks dunia nyata.',
    'Learning program direction': 'Arah program pembelajaran',
    'Educator development': 'Pengembangan pendidik',
    'Learning facilitation': 'Fasilitasi pembelajaran',
    'Leads the development of purposeful learning experiences that connect creativity, projects, and real-world impact.': 'Memimpin pengembangan pengalaman belajar yang menghubungkan kreativitas, proyek, dan dampak nyata.',
    'Supports educators in creating thoughtful, structured, and engaging learning experiences for young people.': 'Mendukung pendidik dalam menciptakan pengalaman belajar yang terarah, terstruktur, dan menarik.',
    'Supports hands-on sessions and helps learners move from curiosity to confident project creation.': 'Mendukung sesi praktik dan membantu siswa mengubah rasa ingin tahu menjadi karya yang percaya diri.',
  },
  zh: {
    'Explore everyday challenges through hands-on STEAM projects and upcycling.': '通过动手 STEAM 与再造项目探索日常挑战。',
    'Develop creative solutions to real-world problems through practical projects.': '通过实践项目为真实问题提出创意解决方案。',
    'Discover thematic STEAM activities with a hands-on learning kit.': '借助动手学习套件探索主题 STEAM 活动。',
    'Connect everyday science with curiosity, teamwork, and environmental awareness.': '将日常科学与好奇心、团队合作和环保意识连接起来。',
    'Create purposeful digital projects while developing coding and problem-solving skills.': '创作有意义的数字项目，同时培养编程与解决问题的能力。',
    'Explore coding, visual design, and three-dimensional game creation.': '探索编程、视觉设计和三维游戏创作。',
    'Create augmented-reality stories that connect digital and physical worlds.': '创作连接数字世界与现实世界的增强现实故事。',
    'Develop animation fundamentals through structured, creative practice.': '通过结构化创意练习掌握动画基础。',
    'Draw characters and express original stories through anime-inspired art.': '绘制角色，并以动漫艺术表达原创故事。',
    'Explore creativity and aesthetic awareness through visual and digital arts.': '通过视觉与数字艺术探索创造力和审美意识。',
    'Students · School break': '学生 · 学校假期',
    'Students · Weekends': '学生 · 周末',
    'Schools · Students': '学校 · 学生',
    'School groups': '学校团体',
    'Online / Onsite': '线上 / 线下',
    'At partner schools': '合作学校内',
    Onsite: '线下',
    'Creative project-based experiences that turn school holidays into meaningful time for discovery and making. Students explore a real-world theme, develop an original idea, build a practical outcome, and share what they learn with confidence.': '通过创意项目式体验，让学校假期成为探索、创造和自信分享的有意义时光。',
    'Hands-on STEAM projects that build curiosity, teamwork, confidence, and practical skills at a comfortable weekend pace. Each session invites students to experiment, improve their ideas, and celebrate progress through a tangible project.': '以舒适的周末节奏开展动手 STEAM 项目，培养好奇心、协作、自信与实践能力。',
    'A school-developed learning program that enriches the curriculum through creativity, technology, and innovation. KRYAcademia works with the school to shape relevant themes, learning outcomes, schedules, and projects for its students.': '与学校共同设计的学习项目，通过创意、科技与创新丰富课程。',
    'Field studies and guided experiences that connect classroom knowledge with real-world contexts. Students observe, ask questions, collect insights, and turn their discoveries into thoughtful reflections or collaborative project outcomes.': '通过实地学习和引导体验，把课堂知识与真实世界连接起来。',
    'Learning program direction': '学习项目规划',
    'Educator development': '教育者发展',
    'Learning facilitation': '学习引导',
    'Leads the development of purposeful learning experiences that connect creativity, projects, and real-world impact.': '负责设计连接创意、项目与真实影响的目标导向学习体验。',
    'Supports educators in creating thoughtful, structured, and engaging learning experiences for young people.': '支持教育者为青少年设计用心、结构清晰且有吸引力的学习体验。',
    'Supports hands-on sessions and helps learners move from curiosity to confident project creation.': '支持动手学习，帮助学生把好奇心转化为自信的项目创作。',
  },
};

type LanguageState = { language: Language; setLanguage: (language: Language) => void; copy: (typeof messages)[Language]; localize: (text: string) => string };
const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : language; }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage,
    copy: messages[language],
    localize: (text: string) => language === 'en' ? text : localizedText[language][text] || text,
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider');
  return value;
}

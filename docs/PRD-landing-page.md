# Product Requirements Document: KRYAcademia Landing Page

## 1. Ringkasan Dokumen

| Item | Detail |
| --- | --- |
| Produk | KRYAcademia Public Landing Page |
| Versi PRD | 1.0 |
| Status | Baseline dari implementasi saat ini |
| Audiens internal | KRYAcademia, tim produk, desain, konten, dan engineering |
| Platform | Web responsif, desktop dan mobile |
| Bahasa publik | Inggris |
| Brand promise | The 21st Education Center |

Dokumen ini menjadikan landing page KRYAcademia yang sudah dibangun sebagai baseline produk. PRD ini menjelaskan tujuan, alur pengguna, kebutuhan fungsional, batasan, serta pekerjaan yang masih diperlukan sebelum website dipakai sebagai kanal publik dan akuisisi yang penuh.

## 2. Latar Belakang

KRYAcademia membutuhkan website publik yang mampu memperkenalkan pendekatan project-based learning, menampilkan pilihan Klass dan program, menunjukkan dokumentasi kegiatan, membangun kepercayaan sekolah dan keluarga, serta mengarahkan minat pengguna menjadi inquiry yang dapat ditindaklanjuti.

Informasi KRYAcademia sebelumnya tersebar pada halaman resmi, materi dokumentasi, dan komunikasi langsung. Landing page menyatukan informasi tersebut dalam pengalaman yang lebih terstruktur, visual, dan mudah dijelajahi.

## 3. Masalah Pengguna

1. Orang tua dan siswa sulit memahami pilihan pembelajaran yang tersedia, format kelas, dan cara memulai.
2. Sekolah atau institusi membutuhkan gambaran yang jelas tentang bentuk kolaborasi dan program yang dapat disesuaikan.
3. Calon pengguna membutuhkan bukti kegiatan nyata sebelum menghubungi KRYAcademia.
4. Tim KRYAcademia membutuhkan satu jalur inquiry yang mengumpulkan konteks kebutuhan calon pengguna.
5. Informasi agenda, berita, program, dan katalog harus dapat diperbarui tanpa merusak pengalaman utama website.

## 4. Tujuan Produk

### 4.1 Tujuan utama

- Menjelaskan posisi KRYAcademia sebagai pusat pembelajaran kreatif dan berbasis proyek.
- Membantu pengguna menemukan Klass, program, agenda, dan bentuk kolaborasi yang relevan.
- Menumbuhkan kepercayaan melalui dokumentasi aktivitas, partner institution, SDGs, dan update resmi.
- Mengarahkan pengguna ke inquiry form, email, atau WhatsApp dengan konteks yang tepat.
- Menyediakan pengalaman responsif, mudah dipindai, dan tetap nyaman di perangkat mobile.

### 4.2 Indikator keberhasilan

- Rasio klik CTA `Explore Klass`, `See How We Learn`, dan `Partner With KRYAcademia`.
- Rasio pengguna yang memulai dan menyelesaikan inquiry form.
- Jumlah klik email dan WhatsApp dari section kontak.
- Interaksi dengan filter Klass, agenda, program detail, Activities, dan Updates.
- Tidak ada horizontal overflow atau elemen terpotong pada lebar 320 sampai 1440 px.
- Core Web Vitals berada pada kategori baik setelah website memakai data produksi.

Target numerik ditetapkan setelah analytics memiliki baseline minimal 30 hari.

## 5. Non-Goals

Versi landing page ini tidak mencakup:

- Pembayaran atau checkout kelas.
- Akun siswa, orang tua, guru, atau admin yang aktif.
- Learning management system.
- Pengelolaan jadwal dan kapasitas kelas secara real-time.
- CMS atau dashboard admin untuk memperbarui konten.
- Pengiriman sertifikat, laporan belajar, atau dokumen akademik.
- Otomasi WhatsApp dan email marketing.

Halaman `/login` hanya berfungsi sebagai halaman `Coming Soon` sampai portal terpisah siap.

## 6. Target Pengguna

### 6.1 Orang tua

Mencari kegiatan belajar yang relevan, aman, kreatif, dan sesuai minat anak. Membutuhkan informasi ringkas mengenai topik, format, manfaat, serta kontak yang mudah dihubungi.

### 6.2 Siswa

Ingin melihat pengalaman belajar yang menarik, hasil proyek, dokumentasi kegiatan, dan pilihan kelas yang sesuai minat.

### 6.3 Sekolah dan institusi

Mencari partner untuk program kurikuler, ekstrakurikuler, workshop, learning journey, atau program khusus dengan tujuan pembelajaran yang dapat disesuaikan.

### 6.4 Tim KRYAcademia

Membutuhkan landing page sebagai sumber informasi resmi dan kanal masuk inquiry yang membawa konteks cukup untuk tindak lanjut.

## 7. Proposisi Nilai

KRYAcademia menghadirkan pembelajaran berbasis proyek yang menggabungkan kreativitas, teknologi, inovasi, kolaborasi, dan refleksi. Pengalaman belajar dirancang agar siswa tidak hanya memahami materi, tetapi juga menghasilkan karya, menguji ide, dan menghubungkan pembelajaran dengan dampak nyata.

## 8. Arsitektur Informasi

Urutan konten utama:

1. Navbar dan pencarian.
2. Hero dan upcoming agenda.
3. Statistik dampak.
4. Katalog Klass.
5. Why KRYAcademia dan kaitan dengan SDGs.
6. Programs.
7. Agenda.
8. Our Activities.
9. Partner Schools.
10. KRYAcademia Updates.
11. FAQ.
12. Get in Touch dan inquiry form.
13. Footer.

## 9. User Journey Utama

### 9.1 Menemukan dan menanyakan Klass

Pengguna membuka website, memahami value proposition, memilih mode atau kategori Klass, membuka CTA pada kartu, lalu inquiry form terisi dengan tipe `Klass` dan nama Klass yang dipilih. Pengguna melengkapi data, mode, pesan, dan persetujuan sebelum mengirim.

### 9.2 Menanyakan program

Pengguna membuka kartu program, membaca detail dan dokumentasi pada modal, lalu memilih `Request This Program`. Inquiry form menerima tipe dan nama program yang dipilih.

### 9.3 Menjalin kemitraan sekolah

Pengguna melihat logo partner dan memilih `Partner With KRYAcademia`. Inquiry form otomatis memilih `School Partnership` dan meminta nama institusi serta jenjang sekolah.

### 9.4 Menjelajahi agenda

Pengguna memilih tanggal atau kartu event. Kalender dan daftar event saling memperbarui, tanggal terpilih diberi highlight, dan event pada tanggal tersebut diprioritaskan.

### 9.5 Menghubungi langsung

Pengguna dapat membuka aplikasi email melalui `aha@krya.global` atau WhatsApp Admin KRYAcademia melalui `+62 851-1121-2362`.

## 10. Functional Requirements

### FR-01 Navbar dan navigasi

- Navbar menampilkan logo KRYAcademia, navigasi section, pencarian, Login, dan menu mobile.
- Section aktif berubah mengikuti posisi scroll.
- Navigasi memakai anchor menuju section terkait.
- Desktop menampilkan menu utama tanpa bergantung pada hamburger.
- Mobile menyediakan menu ringkas yang tetap mudah dioperasikan.

### FR-02 Pencarian

- Pencarian terbuka sebagai dialog dan langsung memfokuskan input.
- Pencarian mencakup Klass, program, agenda, dan partner school.
- Maksimal delapan hasil ditampilkan untuk satu pencarian.
- Memilih hasil menutup dialog dan membawa pengguna ke section terkait.

### FR-03 Hero

- Hero menampilkan headline `The 21st Education Center`, deskripsi singkat, dan dua CTA utama.
- CTA utama adalah `Explore Klass` dan `See How We Learn`.
- Visual kanan hanya menampilkan upcoming agenda dari data agenda.
- Pengguna dapat berpindah agenda dengan kontrol sebelumnya dan berikutnya.
- Pergantian gambar dan informasi harus halus serta menghormati preferensi reduced motion.
- Label dekoratif menggunakan `INSPIRING -> CREATING -> DEDICATING`.

### FR-04 Statistik dampak

- Menampilkan Students, Partner Institution, Programs, dan Klass.
- Angka dianimasikan saat pertama kali masuk viewport.
- Angka aktual wajib berasal dari sumber yang disetujui sebelum publikasi.

### FR-05 Katalog Klass

- Menampilkan katalog Klass lengkap dengan foto, mode, kategori, deskripsi, dan CTA.
- Pengguna dapat memfilter berdasarkan `All modes`, `Online`, atau `Onsite`.
- Pengguna dapat memfilter berdasarkan kategori `Innovation & Creativity`, `Technology`, atau `Art & Language`.
- Kombinasi filter tidak boleh menghilangkan seluruh katalog karena state yang rusak.
- Empty state menyediakan aksi untuk kembali ke seluruh Klass.
- CTA kartu mengisi inquiry form dengan Klass terkait.

### FR-06 Why KRYAcademia

- Menjelaskan background, vision, dan mission KRYAcademia.
- Dokumentasi utama menggunakan efek scroll expand tanpa mengorbankan keterbacaan.
- Section menampilkan gambar 17 SDGs sebagai informasi non-interaktif.
- Copy menghubungkan project-based learning KRYAcademia dengan kontribusi terhadap masa depan berkelanjutan.

### FR-07 Programs

- Menampilkan Holiday Program, Weekend Program, Extra-Intra Curricular, dan Learning Journey.
- Kartu dapat diklik untuk membuka modal detail.
- Modal berada di tengah layar, memiliki animasi masuk/keluar, dokumentasi foto, deskripsi lengkap, target peserta, format, dan CTA inquiry.
- Modal dapat ditutup melalui tombol close, klik backdrop, dan perilaku dialog native.
- Section menyediakan jalur untuk meminta custom program.

### FR-08 Agenda

- Kalender menampilkan bulan, navigasi bulan, penanda hari ini, tanggal terpilih, dan tanggal yang memiliki event.
- Perpindahan highlight tanggal dianimasikan secara halus.
- Klik event mengubah tanggal terpilih pada kalender.
- Klik tanggal memperbarui dan memprioritaskan event terkait.
- Filter mencakup All, Upcoming, Today, dan Past.
- Kalender dapat digunakan dengan keyboard panah.
- Data agenda produksi harus menggantikan sample agenda sebelum peluncuran resmi.

### FR-09 Our Activities

- Menampilkan foto dokumentasi tanpa judul visual pada setiap gambar.
- Galeri bergerak secara infinite tanpa ujung yang terlihat.
- Mendukung drag, wheel gesture horizontal, tombol sebelumnya/berikutnya, dan keyboard panah.
- Scroll vertikal halaman tetap dapat digunakan saat pointer berada di area galeri.
- Perangkat reduced motion memakai fallback gambar tanpa WebGL motion.

### FR-10 Partner Schools

- Menampilkan logo sekolah atau institusi tanpa nama teks pada loop utama.
- Logo bergerak terus-menerus, dapat pause saat hover, dan tetap terbaca di mobile.
- CTA partnership mengisi inquiry form dengan konteks `School Partnership`.
- Terminologi `Partner Schools` versus `Partner Institution` harus diputuskan secara konsisten sebelum publikasi.

### FR-11 KRYAcademia Updates

- Menampilkan seluruh update yang tersedia, bukan hanya tiga item pertama.
- Setiap kartu memiliki gambar, kategori, judul, ringkasan, dan tautan ke artikel resmi.
- Desktop menyediakan tombol previous/next dan horizontal scrolling.
- Mobile mendukung swipe serta tidak memicu overflow halaman.
- Tautan eksternal terbuka pada tab baru.

### FR-12 FAQ

- FAQ menggunakan accordion dengan satu item awal terbuka.
- Konten menjawab peserta, mode, lokasi, custom program, registrasi, dan kanal kontak.
- Section menyediakan tautan langsung ke inquiry form.

### FR-13 Inquiry dan kontak

- Form meminta nama, email, nomor WhatsApp, kota/negara, inquiry type, afiliasi, pesan, dan consent.
- Inquiry type menentukan field lanjutan yang relevan.
- Pilihan afiliasi adalah Institution, Parent, atau Non-institution.
- Memilih Institution mengubah pilihan menjadi input nama institusi.
- Klass meminta Klass of Interest dan Preferred Mode.
- Program meminta Program of Interest.
- School Partnership meminta School Level.
- Workshop, Event, dan Other meminta konteks tambahan.
- Field wajib harus divalidasi dan menampilkan pesan yang jelas.
- Submit menampilkan loading state dan notifikasi sukses.
- Email dan WhatsApp harus dapat diklik; WhatsApp diberi label Admin KRYAcademia.

### FR-14 Footer dan portal

- Footer mengulang navigasi penting, alamat, email, WhatsApp, serta tautan kembali ke atas.
- Tautan Teacher & Admin Portal menuju `/login`.
- Sampai portal aktif, `/login` menampilkan status `Coming Soon` dan tautan kembali ke landing page.

## 11. Content Requirements

- Seluruh public copy menggunakan bahasa Inggris yang konsisten.
- Montserrat menjadi font utama; font editorial digunakan terbatas untuk aksen judul seperti kata `Education`.
- Foto harus menunjukkan kegiatan KRYAcademia yang nyata dan relevan.
- Gambar vector atau logo tidak boleh menggantikan dokumentasi jika foto kegiatan tersedia.
- Konten Klass mengacu pada katalog resmi KRYAcademia.
- Program, agenda, statistik, dan mode Klass harus mendapatkan persetujuan pemilik konten.
- Updates mengarah ke artikel resmi dan mengikuti workflow konten yang disepakati tim.
- Logo KRYAcademia dan partner memakai aset resmi.

## 12. Design dan Interaction Requirements

- Identitas visual memakai navy, merah KRYAcademia, putih/off-white, dan aksen hangat secara seimbang.
- Desain mempertahankan karakter premium educational/editorial, bukan tampilan dashboard atau landing page generik.
- Kartu maksimal memakai radius 8 px kecuali komponen yang secara visual membutuhkan bentuk lain.
- Motion bersifat pendukung, tidak menghambat scroll, navigasi, atau pemahaman konten.
- Cursor-following gradient hanya aktif pada perangkat pointer presisi dan dinonaktifkan untuk reduced motion atau coarse pointer.
- Semua tombol ikon memiliki accessible name atau tooltip yang jelas.
- Fokus keyboard harus terlihat dan urutan tab harus logis.

## 13. Responsive Requirements

- Rentang validasi minimum: 320, 360, 390, 720, 768, 1024, 1280, dan 1440 px.
- Tidak ada teks, tombol, kartu, dialog, atau gambar yang terpotong.
- Katalog dan program menjadi lebih ringkas di mobile agar beberapa konten dapat dipindai tanpa scroll berlebihan.
- Program menempatkan gambar di atas copy pada mobile.
- Modal program menggunakan hampir seluruh viewport mobile, dengan area konten yang dapat di-scroll.
- Agenda menjaga hubungan visual antara tanggal dan event serta membawa event terpilih ke prioritas atas.
- Activities mempertahankan ruang scroll vertikal yang cukup untuk menuju section berikutnya.
- Updates dan filter chip dapat digeser horizontal tanpa membuat body overflow.

## 14. Accessibility Requirements

- Mengikuti WCAG 2.2 level AA sebagai target.
- Semua gambar informatif memiliki alt text; gambar dekoratif memakai alt kosong.
- Kontras copy dan kontrol minimal memenuhi standar AA.
- Semua fungsi utama dapat digunakan dengan keyboard.
- Carousel memiliki label region, kontrol bernama, dan status item untuk assistive technology.
- Dialog program memiliki judul, deskripsi, close control, dan focus behavior yang benar.
- State filter menggunakan `aria-pressed` atau semantics yang setara.
- Animasi menyediakan reduced-motion behavior.
- Form menghubungkan label, error, required state, dan consent secara programatis.

## 15. Technical Requirements

- Framework saat ini: Next.js 16, React 19, TypeScript, dan Vinext/Vite toolchain.
- Media publik disimpan secara lokal untuk mengurangi ketergantungan CORS dan perubahan URL eksternal.
- Next Image digunakan untuk optimasi gambar yang sesuai.
- WebGL Activities hanya dirender saat mendekati viewport dan berhenti saat di luar viewport.
- Website harus lulus production build, TypeScript check, focused lint, dan responsive browser check sebelum rilis.
- Implementasi tidak boleh mengirim data personal sebelum backend, privacy notice, storage policy, dan consent flow disetujui.

## 16. Status Implementasi Saat Ini

| Area | Status | Catatan |
| --- | --- | --- |
| Navbar, search, hero, statistik | Implemented | Konten dan angka perlu final approval |
| Katalog Klass dan filter | Implemented | Mode dan jadwal perlu konfirmasi berkala |
| Why KRYAcademia dan SDGs | Implemented | Menggunakan scroll expand dan gambar SDGs |
| Program cards dan modal | Implemented | Program copy menunggu final approval |
| Agenda interaktif | Prototype | Masih memakai sample data September 2026 |
| Activities infinite gallery | Implemented | Menggunakan dokumentasi lokal dan reduced-motion fallback |
| Partner logo loop | Implemented | Terminologi section perlu diputuskan |
| Updates carousel | Implemented | Tautan menuju artikel eksternal resmi |
| FAQ | Implemented | Konten perlu owner dan jadwal review |
| Inquiry form | UI prototype | Belum mengirim atau menyimpan data |
| Email dan WhatsApp | Implemented | Menggunakan kanal kontak langsung |
| Teacher & Admin Portal | Placeholder | Halaman Coming Soon |

## 17. Data dan Integrasi yang Dibutuhkan

### 17.1 Inquiry backend

Sebelum form produksi diaktifkan, tentukan:

- Endpoint penerimaan form.
- Sistem tujuan, misalnya CRM, email inbox, spreadsheet terkontrol, atau database.
- Owner dan SLA tindak lanjut inquiry.
- Proteksi spam dan rate limiting.
- Privacy notice, retensi data, dan akses data.
- Success, retry, duplicate submission, dan failure state.

### 17.2 Agenda

Agenda membutuhkan sumber data resmi dengan minimal field: ID, tanggal, judul, jenis, mode, waktu, lokasi atau platform, status registrasi, tautan, dan gambar.

### 17.3 Konten

Tetapkan owner untuk Klass, Programs, Agenda, Updates, FAQ, statistik, dokumentasi, dan partner institution. Setiap area membutuhkan sumber resmi dan jadwal review.

### 17.4 Analytics

Event minimum:

- `hero_cta_clicked`
- `search_opened` dan `search_result_clicked`
- `klass_filter_changed` dan `klass_inquiry_started`
- `program_opened` dan `program_inquiry_started`
- `agenda_date_selected` dan `agenda_event_selected`
- `partner_inquiry_started`
- `update_opened`
- `contact_channel_clicked`
- `inquiry_started`, `inquiry_validation_failed`, dan `inquiry_submitted`

Analytics tidak boleh merekam isi pesan atau data personal pengguna.

## 18. Acceptance Criteria Rilis Publik

1. Semua konten, statistik, mode Klass, agenda, program, dan partner telah disetujui owner.
2. Inquiry berhasil dikirim ke tujuan yang disepakati dan memiliki error handling nyata.
3. Consent dan privacy notice telah disetujui.
4. Semua CTA mengarah ke tujuan yang benar dan mempertahankan konteks inquiry.
5. Tidak ada broken image, broken link, placeholder, atau label sample pada produksi.
6. Search, filter, modal, kalender, carousel, accordion, form, email, dan WhatsApp lolos uji desktop dan mobile.
7. Keyboard navigation, focus state, alt text, contrast, dan reduced motion lolos audit aksesibilitas dasar.
8. Production build, TypeScript, lint yang relevan, dan responsive checks lulus.
9. Analytics dan error monitoring aktif tanpa merekam data personal sensitif.
10. Performa gambar, WebGL, dan animasi tidak mengganggu Core Web Vitals.

## 19. Tahapan Pengembangan

### Phase 1: Content readiness

- Finalisasi statistik, mode Klass, program, agenda, partner terminology, dan FAQ.
- Ganti seluruh sample content dan placeholder.
- Tetapkan content owner.

### Phase 2: Inquiry production

- Hubungkan form ke backend atau CRM.
- Tambahkan privacy notice, spam protection, error state, dan monitoring.
- Uji alur inquiry dari seluruh CTA.

### Phase 3: Measurement dan operations

- Tambahkan analytics yang disetujui.
- Bentuk workflow Updates dan Agenda.
- Pantau conversion, performa, error, dan pertanyaan pengguna.

### Phase 4: Portal

- Definisikan PRD terpisah untuk Teacher & Admin Portal.
- Aktifkan login hanya setelah autentikasi, role, data model, dan keamanan siap.

## 20. Open Decisions

1. Apakah istilah publik final adalah `Partner Schools` atau `Partner Institutions`?
partner institutions
2. Siapa pemilik angka Students, Partner Institution, Programs, dan Klass?
itu nanti kita baru mintakan di jeremy
3. Apa sumber resmi agenda dan siapa yang memperbaruinya?
untuk sumber resmi agenda ada
4. Ke mana inquiry harus dikirim dan berapa SLA responsnya?
5. Apakah form memerlukan bahasa Indonesia selain copy publik berbahasa Inggris?
6. Apakah Updates dikelola manual, dari CMS, atau ditarik dari website resmi?
7. Apakah hero agenda berjalan otomatis atau tetap manual untuk kontrol pengguna?
8. Kapan Teacher & Admin Portal masuk scope produk?

## 21. Definition of Done

Landing page dinyatakan siap produksi ketika seluruh acceptance criteria terpenuhi, konten sudah mendapatkan persetujuan KRYAcademia, inquiry benar-benar terkirim dengan aman, dan pengalaman utama telah diverifikasi pada desktop, mobile, keyboard, reduced motion, serta koneksi yang lebih lambat.

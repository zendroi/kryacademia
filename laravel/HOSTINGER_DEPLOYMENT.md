# Deploy KRYAcademia Laravel ke Hostinger

Versi ini menggunakan Laravel 13, Inertia 3, React 19 dan PHP **8.4 atau lebih baru** sesuai composer.lock. React dibangun menjadi aset statis di komputer pengembang; server Hostinger tidak membutuhkan proses Node.js. Gunakan PHP dengan PDO MySQL, OpenSSL, Fileinfo, Mbstring dan GD yang mendukung JPEG, PNG serta WebP.

## Perlindungan data

- Jangan menimpa website LMS atau database lain yang sudah berjalan. Gunakan website preview dan database kosong khusus KRYAcademia dahulu.
- Jangan menjalankan `migrate:fresh`, `db:wipe`, atau seeder demo pada data perusahaan. Seeder dibatasi ke local/testing dan tidak mengubah password atau mengaktifkan kembali arsip yang sudah ada.
- Database PostgreSQL sumber tetap menjadi sumber baca selama latihan. Cutover membutuhkan snapshot baru setelah penulisan sumber dihentikan, pemeriksaan hasil, dan penyimpanan sumber lama untuk rollback.
- Pertahankan BACKUP_KEY dari ekspor terenkripsi di tempat privat terpisah. Kehilangan kunci membuat snapshot tidak bisa dibaca. Jangan memasukkan kredensial atau snapshot perusahaan ke Git.

## Build dan pengujian lokal

```sh
composer install
npm ci --ignore-scripts
npm run build
php artisan test --compact
composer check-platform-reqs
php -r 'echo json_encode(gd_info()), PHP_EOL;'
```

Build menjalankan pengecekan TypeScript sebelum Vite. PHP untuk pengujian gambar harus mempunyai dukungan WebP; sebagian instalasi PHP minimal di Windows belum menyediakannya. Suite PHPUnit menolak reset database di luar SQLite in-memory atau database loopback bernama `krya_laravel_test_*`.

Browser check memakai Playwright yang sudah tersedia di lingkungan pengembang. Atur `PHP_BINARY` ke PHP yang mempunyai GD/WebP dan, bila Playwright berada di proyek lama, `KRYA_BROWSER_PACKAGE` ke package.json proyek tersebut, lalu jalankan `node tests/Browser/check.mjs`. Checker membuat database dan akun sementara sendiri; tidak menggunakan database perusahaan.

Salinan lokal hasil migrasi berada di database/company.sqlite, terpisah dari database/database.sqlite awal yang tetap disimpan. Semua kolom asli pada 37 tabel dan 284 baris telah dibandingkan dengan ekspor terenkripsi di SQLite dan MariaDB 11.8.9. Konfigurasi lokal sebelumnya disimpan terenkripsi di storage/app/private/laravel-env-before-company-20261103.enc. Kunci aplikasi lokal yang cocok dengan contoh dalam riwayat Git telah diganti khusus pada instalasi lokal baru ini; BACKUP_KEY sumber dan hash password tidak berubah. Installer juga tidak merotasi APP_KEY yang sudah ada. Jangan mengunggah file-file privat ini ke Git atau public_html.

Di Windows pengembangan ini, jalankan dari direktori proyek dengan PHP yang sudah diverifikasi mempunyai GD/WebP:

```powershell
& "$env:USERPROFILE\.cache\kryacademia-php-8.4\php.exe" artisan serve --host=127.0.0.1 --port=8000
```

Data katalog lokal berisi 9 institusi aktif, 25 grup kelas aktif dan 8 grup arsip. Nama siswa aktif belum tersedia dalam sumber; jumlah siswa dari spreadsheet tidak dibuat menjadi akun/nama dummy. Artwork kelas dan logo landing page yang sudah tersedia dipertahankan saat kolom media katalog masih kosong, sedangkan coach tanpa foto menggunakan inisial. Upload media admin akan menggantikan tampilan cadangan tersebut tanpa mengubah riwayat.

## Konfigurasi produksi

Buat .env privat di direktori backend. Isi kredensial dari hPanel sendiri; jangan menggunakan password atau APP_KEY dari contoh dokumentasi. Database yang dipilih harus merupakan database kosong khusus migrasi ini.

```env
APP_NAME=KRYAcademia
APP_ENV=production
APP_DEBUG=false
APP_URL=https://subdomain-preview-anda
APP_KEY=

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nama_database_dari_hpanel
DB_USERNAME=user_database_dari_hpanel
DB_PASSWORD=
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_bin

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
CACHE_STORE=database
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local
BACKUP_KEY=
```

Buat APP_KEY baru dengan `php artisan key:generate --force` **hanya saat menyiapkan instalasi baru yang belum digunakan**. Saat memulihkan instalasi aktif, pertahankan APP_KEY aslinya. BACKUP_KEY adalah kunci ekspor sumber, bukan APP_KEY. Simpan rahasia melalui hPanel atau file yang tidak dapat diakses publik.

## Penempatan file

Document root wajib menunjuk hanya ke folder `public/`. Backend, .env, vendor, database dan storage harus berada di luar document root. File .htaccess di root backend menolak akses publik; jangan mengandalkan rewrite seluruh proyek ke public_html.

Jika document root tidak dapat diarahkan langsung ke public:

1. Letakkan proyek lengkap dalam direktori privat, misalnya `laravel`, di samping public_html untuk website preview.
2. Salin **isi** laravel/public ke public_html, termasuk .htaccess dan hasil build. Pertahankan salinan public/build di proyek backend agar manifest Vite tetap tersedia.
3. Pada public_html/index.php, sesuaikan ketiga referensi menuju storage/framework/maintenance.php, vendor/autoload.php dan bootstrap/app.php agar menunjuk ke direktori laravel tersebut.
4. Jalankan perintah Artisan dari direktori backend laravel. Saat memperbarui build, salin aset publik dan manifest dari build yang sama.

Bila memakai Git deployment, folder vendor dan public/build tidak ikut Git. Instal dependency PHP dengan `composer install --no-dev --prefer-dist --optimize-autoloader`, kemudian unggah build frontend dari lokal. Untuk deploy ZIP, gunakan vendor produksi yang sesuai composer.lock, sertakan public/build, dan keluarkan node_modules, .env lokal, database lokal, snapshot, tests serta isi storage/logs dan storage/framework/testing. Jangan membawa config cache lokal ke server.

Storage privat harus persisten dan writable. Salin storage/app/private/objects sebagai data pengguna privat terpisah dari paket kode; keluarkan database latihan, browser-check, laporan pengujian dan backup konfigurasi dari paket aplikasi. Jangan menjalankan `storage:link` untuk KTP atau dokumentasi teacher. File privat dilayani melalui endpoint dengan pemeriksaan akun, kepemilikan, hash dan header sandbox. Tidak ada proses yang menjalankan isi upload; gambar didekode dan dikompresi ulang, sedangkan PDF dibatasi dan diperiksa konten aktifnya.

## Migrasi data perusahaan

Dari **proyek web lama di komputer lokal**, buat ekspor baru dengan helper yang sudah ada. Perintah ini hanya membaca sumber:

```sh
node --env-file=.env.local --env-file=.env.backup.local scripts/hostinger-data.mjs export /lokasi/privat/snapshot-baru
```

Simpan direktori terenkripsi itu secara privat, lalu pindahkan salinannya ke direktori nonpublik pada server tujuan. Atur BACKUP_KEY tujuan ke kunci yang sama. Dari proyek Laravel:

```sh
php artisan migrate --force
php artisan academy:import-legacy /lokasi/privat/snapshot-baru
php artisan academy:import-legacy /lokasi/privat/snapshot-baru --apply
```

Perintah pertama membentuk skema tanpa menghapus tabel/data lama. Impor selalu dimulai dengan preview. `--apply` menolak target yang sudah berisi data atau akun Laravel. Semua 37 tabel asli disalin dan diperiksa setiap kolomnya sebelum commit; akun Laravel diturunkan dari akun asli tanpa mengganti password. ID, arsip, riwayat approval, catatan admin, nilai, timestamp mikrodetik dan file biner dipertahankan. File eksternal ekspor disalin ke storage privat dan diverifikasi hash-nya; referensi sumber tetap tersimpan.

Arsip salah kunci, berubah isinya, kehilangan file, atau tidak cocok skemanya ditolak. Snapshot terenkripsi juga disimpan di storage/app/private/imports untuk penelusuran. Impor ulang snapshot yang sama tidak menimpa perubahan operasional setelah impor. Jangan mengubah manifest agar lolos pemeriksaan.

Batas importer: 128 MiB per tabel, 256 MiB total payload dan 1 MiB per objek file, sesuai batas ekspor lama. Untuk data melampaui batas ini diperlukan migrasi streaming sebelum cutover.

## Operasional dan pemeriksaan akhir

```sh
php artisan optimize
php artisan schedule:list
php artisan route:list --except-vendor
```

Atur cron hPanel **setiap menit**, dengan command menuju backend privat:

```sh
cd /home/USER/domains/WEBSITE/laravel && /usr/bin/php artisan schedule:run >> storage/logs/scheduler.log 2>&1
```

Pastikan binary PHP cron memakai versi dan extension yang sama dengan aplikasi. Pengingat H-3, H-1 dan sekali saat terlambat mengikuti Asia/Jakarta. Delivery dashboard diproses oleh `academy:notifications`; tidak memerlukan worker Node.js. API pengirim email/WhatsApp belum dikonfigurasi dan antarmuka menampilkan status tersebut secara jelas.

Sebelum mengalihkan domain, cek HTTPS, login admin/teacher, pembatalan sesi, onboarding KTP privat, penugasan kelas, feedback siswa hadir/tidak hadir, silabus, lesson plan, Canva, class request, review admin, rekap kehadiran Approved, inquiry dan notifikasi pada website preview. Pastikan file privat tidak dapat dibuka sebagai URL storage publik dan tetap tersedia setelah update aplikasi.

Database dan file sumber tidak dihapus. Simpan backup di lokasi terpisah dari hosting. Apabila website tujuan sudah menerima perubahan baru, rollback memerlukan rekonsiliasi perubahan tersebut; jangan sekadar mengalihkan domain ke snapshot lama.

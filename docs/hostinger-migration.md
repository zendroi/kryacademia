# Migrasi Hostinger / MySQL dan MariaDB

Status 2 November 2026: adapter MySQL/MariaDB, skema, query aplikasi, storage privat lokal, export/import dan backup/restore tersedia. Aplikasi aktif tetap PostgreSQL. Database Hostinger sudah dibuat dan masih kosong; phpMyAdmin mengonfirmasi **MariaDB 11.8.9**. Deployment aplikasi dan migrasi final belum dijalankan.

## Keputusan dan batas kesiapan

- Tujuan: Hostinger Web Hosting dengan Node.js, bukan VPS. Semua akun, hash password, submission, approval, arsip dan file privat dipindahkan; tanpa seed demo.
- Implementasi memerlukan **MySQL >=8.0.21 atau MariaDB >=11.8.9**, InnoDB, max_allowed_packet >=4 MiB, serta izin membuat/mengubah tabel, indeks dan views. Tujuan Hostinger yang terverifikasi memakai MariaDB 11.8.9; URL koneksi tetap memakai protokol mysql://.
- Uji lokal memakai MySQL 8.4 dan MariaDB 11.8.9. Export baru sumber perusahaan berhasil dipulihkan ke MariaDB: 37 tabel, 284 baris; katalog dan view riwayat teacher cocok dengan PostgreSQL sumber. Snapshot ini bukan migrasi final.
- Pengujian MariaDB memakai image resmi versi 11.8.9. Driver menormalkan lima field JSON yang pada MariaDB dikirim sebagai LONGTEXT, view memakai JSON_ARRAYAGG dengan ORDER BY, transaksi memakai LOCK IN SHARE MODE, dan pemeriksaan restore memakai server_uid. Jangan melewati validasi engine hanya dengan mengganti label versinya.
- Tes sintetis mencakup isi tabel, rollback impor, bcrypt lama, arsip, timestamp mikrodetik, nomor rekening dengan nol awal, file biner, lima jenis dokumen teacher, transaksi, notifikasi dan backup/restore.
- Browser MySQL dan MariaDB: login dan role redirects, akses privat KTP, pembuatan akun pending dan larangan approval sebelum onboarding, class request teacher sampai approval admin lolos. Preview/apply dan pengulangan impor spreadsheet/pengarsipan juga lolos pada MariaDB tanpa menggandakan data atau mengaktifkan ulang arsip.
- Disk privat harus persisten, di luar aplikasi dan public_html. Persistence sesudah redeploy, HTTPS, scheduler dan proxy masih perlu diuji di Hostinger.
- Rate limit non-Vercel masih memakai bucket IP bersama; batas per akun tetap aktif. Verifikasi header yang dijamin hosting sebelum produksi. Jangan langsung mempercayai X-Forwarded-For dari pengunjung.

## Environment

Gunakan Node 24 atau versi yang memenuhi engines dalam package.json. Rahasia hanya di environment hosting atau file .env.*.local yang diabaikan Git; jangan dikirim lewat chat atau memakai prefix NEXT_PUBLIC_.

| Variabel | Kegunaan |
| --- | --- |
| DATABASE_URL | Database aplikasi/sumber export. Tetap PostgreSQL selama persiapan; MySQL sesudah cutover. |
| HOSTINGER_DATABASE_URL | MySQL tujuan untuk inspect, prepare, import dan runtime; sengaja dipisahkan dari sumber. |
| MYSQL_SSL_CA_FILE | Opsional, path CA untuk MySQL remote. Remote wajib verifikasi TLS; loopback untuk database satu hosting. |
| SESSION_SECRET | Minimal 32 karakter acak; rotasi memaksa login ulang. |
| BACKUP_KEY | 32 byte acak dalam 64 karakter hex untuk AES-256-GCM. Simpan salinan terpisah; kehilangan kunci membuat backup tak dapat dipulihkan. |
| PORTAL_LOCAL_FILE_DIR | Path absolut privat persisten di luar aplikasi/public_html; menunjuk direktori hasil import. |
| BLOB_READ_WRITE_TOKEN | Pertahankan untuk export file Blob lama sampai salinan diverifikasi. |
| CRON_SECRET | Bearer token endpoint scheduler bila dipanggil melalui HTTPS. |
| MYSQL_RESTORE_DATABASE_URL | Database kosong terpisah untuk latihan restore. |
| MYSQL_RESTORE_FILE_DIR | Direktori privat baru untuk file hasil restore. |

Format tujuan: mysql://user:password@127.0.0.1:3306/database. Encode karakter khusus user/password URL. Jangan mengatur VERCEL=1 pada Hostinger; storage disk akan ditolak. Environment hosting menyediakan nilai runtime; .env.local pengembang tidak ikut dikirim.

## Dry-run dan migrasi

Dari root repo, .env.hostinger.local mengatur HOSTINGER_DATABASE_URL, bukan mengganti DATABASE_URL sumber. Ganti path contoh dengan path absolut privat. Direktori induk sudah ada; direktori output/file akhir belum ada.

```sh
# Export sumber PostgreSQL tanpa mengubahnya.
node --env-file=.env.local --env-file-if-exists=.env.backup.local scripts/hostinger-data.mjs export /private/export-new
node --env-file=.env.local --env-file-if-exists=.env.backup.local scripts/hostinger-data.mjs verify-export /private/export-new

# MySQL tujuan kosong.
node --env-file=.env.hostinger.local scripts/hostinger-data.mjs inspect
node --env-file=.env.hostinger.local scripts/hostinger-data.mjs prepare

# Preview dahulu, lalu apply dengan BACKUP_KEY yang sama dengan export.
node --env-file=.env.hostinger.local --env-file-if-exists=.env.backup.local scripts/hostinger-data.mjs import /private/export-new /private/files-new
node --env-file=.env.hostinger.local --env-file-if-exists=.env.backup.local scripts/hostinger-data.mjs import /private/export-new /private/files-new --apply

# WAJIB sesudah import, sebelum aplikasi aktif: defaults, views, lock table.
node --env-file=.env.hostinger.local scripts/hostinger-data.mjs runtime
```

Export menulis tabel/file terenkripsi, manifest terakhir. Arsip terputus/rusak, kunci salah, tabel tidak dikenal atau skema berbeda ditolak. Import menolak target berisi data; semua insert dibatalkan jika isi tidak cocok. DDL MySQL tidak transaksional: prepare terputus dapat meninggalkan skema parsial; gunakan database baru setelah inspeksi. File staging kegagalan tetap privat untuk inspeksi, tidak dihapus otomatis.

Jalankan runtime SESUDAH import: tabel lock internalnya bukan bagian 37 tabel data. Jangan menjalankan db:phase3/4/5/revisions PostgreSQL pada MySQL; guard sekarang menolaknya. Import-company, import-class-request dan archive-pilot memilih driver menurut DATABASE_URL; preview dahulu, perubahan memerlukan --apply.

Batas: 128 MiB per tabel dan 256 MiB total payload restore di memori, file maksimal 1 MiB mengikuti upload aplikasi. Data lebih besar memerlukan streaming.

## Deployment dan cutover

1. Buat website Node.js dan database hPanel. Periksa engine/versi, host, izin, serta disk privat persisten.
   Untuk subdomain LMS, pastikan subdomain ditambahkan sebagai website Node.js tersendiri, bukan hanya folder di website WordPress/PHP utama. Periksa daftar website/dashboard sebelum membuat resource baru. Jangan menghapus atau mengganti website utama untuk menyiapkan LMS. [Panduan Node.js Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).
2. Dry-run pada database preview terpisah; npm ci, npm run build, npm start. Gunakan Next.js Node, bukan static export.
3. Uji HTTPS/login/role, pending/suspended, inquiry, edit katalog, teacher submission/approval, KTP, upload, notifikasi, backup/restore. Redeploy dan pastikan file masih tersedia serta tak dapat dibuka lewat URL publik.
4. Verifikasi header IP yang dijamin reverse proxy, termasuk percobaan pemalsuan dari klien.
5. Cron menjalankan node scripts/run-notification-jobs.mjs dengan environment aplikasi atau endpoint /api/internal/notification-jobs memakai Bearer CRON_SECRET. Cleanup dan backup melalui CLI terjadwal. vercel.json tidak mengatur cron Hostinger. Pengingat tetap H-3, H-1 dan sekali terlambat dalam Asia/Jakarta. API email/WhatsApp belum tersedia.
6. Saat cutover: hentikan penulisan sumber, export final baru, import ke target kosong, verifikasi ulang, baru ganti DATABASE_URL, PORTAL_LOCAL_FILE_DIR dan domain. Snapshot latihan bukan data final.
7. Pertahankan sumber/file lama untuk rollback. Jika target menerima perubahan baru, rollback perlu membawa perubahan itu kembali; jangan sekadar mengganti domain.

Hostinger mendokumentasikan host 127.0.0.1 untuk aplikasi/database pada hosting yang sama; akses komputer lokal mengikuti konfigurasi remote. [Panduan koneksi MySQL](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/).

Request Node.js dibatasi 120 detik dan worker terus-menerus tidak didukung; pekerjaan panjang melalui cron/CLI. [Batas Node.js Hostinger](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/).

## Backup dan pengujian

```sh
# Setelah DATABASE_URL sudah MySQL:
node --env-file=.env.local --env-file-if-exists=.env.backup.local scripts/backup.mjs create /private/backup-new
node --env-file=.env.local --env-file-if-exists=.env.backup.local scripts/backup.mjs check /private/backup-new

node tests/password-check.mjs
node tests/teaching-save-check.mjs
node tests/portal-regression-check.mjs
# Container lokal PostgreSQL 16 di 5433 dan MySQL 8.4 di 3307.
# Kredensial fixture tercantum di tes, bukan kredensial perusahaan.
node tests/hostinger-data-check.mjs
# Sesudah production build:
node tests/hostinger-data-check.mjs --browser
# Target MariaDB 11.8.9 lokal di port 3308, sesuai server Hostinger:
node tests/hostinger-data-check.mjs --mariadb
node tests/hostinger-data-check.mjs --mariadb --browser
# Opsional: uji impor/arsip dengan workbook perusahaan pada database fixture saja.
node tests/hostinger-data-check.mjs --company-workbook=/private/EKSKUL.xlsx
```

Restore check memakai MYSQL_RESTORE_DATABASE_URL dan MYSQL_RESTORE_FILE_DIR, menolak database sumber yang sama atau target tidak kosong. Hasil restore dibiarkan untuk inspeksi. Tidak menjalankan SQL dari arsip: skema berasal dari repo, data memakai parameter query.

Untuk menyiapkan container fixture pada mesin baru (password ini khusus pengujian lokal, bukan produksi):

```sh
docker run -d --name kryacademia-postgres-migration-check -e POSTGRES_PASSWORD=krya_local_migration_check -e POSTGRES_DB=krya_migration_check -p 127.0.0.1:5433:5432 postgres:16-alpine
docker run -d --name kryacademia-mysql-migration-check -e MYSQL_ROOT_PASSWORD=krya_local_migration_check -e MYSQL_DATABASE=krya_migration_check -p 127.0.0.1:3307:3306 mysql:8.4
docker run -d --name kryacademia-mariadb-migration-check --memory 512m -e MARIADB_ROOT_PASSWORD=krya_local_migration_check -e MARIADB_DATABASE=krya_migration_check -p 127.0.0.1:3308:3306 mariadb:11.8.9 --innodb-buffer-pool-size=128M
```

Jika container sudah ada, gunakan docker start dengan nama tersebut; jangan menghapus database latihan yang ingin disimpan. Tunggu database siap sebelum menjalankan tes. Jalankan suite migrasi dan suite keamanan PostgreSQL secara bergantian: pembuatan extension pgcrypto pada database fixture yang sama dapat berbenturan bila dua suite dimulai bersamaan.

Backup perlu disalin ke tempat terpisah dari hosting; scheduler/retensi produksi belum dikonfigurasi. Fixture membuat database/schema acak dan membersihkannya sendiri. Bukti lokal tidak menggantikan pemeriksaan Hostinger.

Perubahan skema portable pada revisi MariaDB mengubah hash skema export. Buat export baru dengan kode terbaru; arsip latihan MySQL sebelumnya akan ditolak jika hash skemanya berbeda. Jangan mengedit manifest untuk memaksa import.

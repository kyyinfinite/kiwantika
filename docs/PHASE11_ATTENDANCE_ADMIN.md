# Phase 11: Absensi v2, Izin/Sakit, Kas, Dashboard Admin

Satu database Supabase, satu pintu kontrol: `/admin`. Semua data (absensi, izin, iuran, kas, pendaftaran, audit) dibaca dari tabel yang sama dan diringkas oleh satu RPC, `admin_overview()`.

## Cara memasang

1. Jalankan `supabase/migrations/0011_phase11_attendance_v2_leave_finance_admin.sql` di SQL Editor Supabase (setelah 0001 sampai 0010).
2. `npm install` (menambah devDependency `tsx`), lalu deploy ke Vercel seperti biasa.
3. Tes lokal basis pengetahuan Tunas: `npm run test:tunas`.

Tidak ada env var baru.

## Absensi v2

| Kelemahan lama | Perbaikan |
|---|---|
| QR statis bisa di-screenshot lalu dikirim ke teman (titip absen) | QR berganti tiap 15 sampai 120 detik (bawaan 30), ditandatangani HMAC-SHA256 per sesi, berlaku slot sekarang dan satu slot sebelumnya |
| PIN 3 sampai 8 angka bisa ditebak tanpa batas oleh akun mana pun | Maksimal 5 kegagalan per anggota per sesi dalam 10 menit, lalu terkunci. Kegagalan dicatat di tabel privat |
| Hash PIN SHA-256 tanpa garam | Sesi baru memakai HMAC dengan secret acak per sesi (tabel `private`, tidak terbaca client) |
| Token dibuat di browser | Token QR tetap dibuat server dan hanya dikembalikan sekali |
| Semua akun login bisa absen, termasuk yang dinonaktifkan | Status `suspended`, `inactive`, `alumni` ditolak |
| Status selalu `hadir` | Ada `terlambat` (batas menit per sesi), plus `izin`, `sakit`, `alpa` |
| Persentase kehadiran dibagi jumlah rekaman sendiri (selalu mendekati 100%) | `my_attendance_summary()` membagi dengan jumlah sesi yang sudah selesai sejak anggota bergabung; izin dan sakit tidak masuk pembagi |
| Pesan error mentah dari database | Kode hasil terstruktur dan pesan bahasa Indonesia |
| Endpoint lama tanpa pembatasan | `check_in_attendance`, `create_attendance_session`, `get_attendance_session` dicabut dari role `authenticated` dan `anon` |

Alur: admin buat sesi di `/admin/absensi`, layar proyektor di `/admin/absensi/:id/layar` (QR, kode 6 angka cadangan, hitungan hadir langsung), anggota scan dengan kamera biasa. Cadangan: `/absen` untuk memasukkan kode 6 angka. Sesi lama dengan QR tetap yang sudah dicetak tetap berfungsi (jalur PIN lama dipakai ulang di fungsi v2).

Rekap: `/admin/absensi/:id` (ubah status manual, ekspor Excel).

## Izin dan sakit

Anggota: `/dashboard/izin`. Admin: `/admin/izin`. Pengajuan per tanggal; persetujuan otomatis tampil sebagai `izin` atau `sakit` di rekap semua sesi pada tanggal itu (zona waktu Asia/Jakarta) dan masuk ringkasan kehadiran anggota. Anggota dan pengelola mendapat notifikasi. Jika anggota ternyata hadir, status berubah menjadi `hadir`.

Koreksi: di versi awal dokumen ini tertulis bahwa Perizinan lama adalah permintaan hak akses. Itu salah. Perizinan lama adalah pengajuan izin per kegiatan, dan sudah digantikan penuh oleh sistem ini pada Phase 12 (lihat `PHASE12_EVENT_ATTENDANCE.md`).

## Kas dan iuran

`/admin/kas` (izin `manage_finance`): buat tagihan bulanan untuk semua anggota aktif, tandai lunas (otomatis membuat transaksi pemasukan kategori `kas` yang tertaut ke tagihan; membatalkan menghapusnya), catat transaksi, ringkasan arus kas per bulan, ekspor Excel.

## Dashboard admin

Panel "ringkasan operasional" di `/admin`: anggota aktif, pendaftaran menunggu, kehadiran 30 hari, izin menunggu, saldo kas, iuran bulan ini, daftar "perlu tindakan", dan aktivitas pengelola terbaru dari `audit_logs`. Bagian absensi hanya muncul untuk izin `manage_attendance`, bagian kas hanya untuk `manage_finance`. Semua aksi penting tercatat di audit log.

## Belum diverifikasi saat runtime (wajib dites setelah deploy)

Lingkungan pengembangan tidak punya PostgreSQL, Supabase, maupun akses jaringan. Yang sudah dicek: bundling esbuild seluruh aplikasi, 35 tes otomatis untuk basis pengetahuan Tunas, dan smoke typecheck dengan shim. Yang belum pernah dijalankan:

1. Migrasi 0011 (dibaca dan ditelaah manual, belum dieksekusi). Jalankan di proyek staging dulu.
2. `npm run build` penuh dengan tipe React asli (tipe di-shim saat pengecekan).
3. Import relatif berakhiran `.js` di `api/chat.ts` pada runtime Vercel. Jika deploy menunjukkan `ERR_MODULE_NOT_FOUND`, pindahkan isi `api/_lib/*` ke file yang sama dengan `chat.ts`.
4. Kualitas jawaban model setelah diberi referensi (lihat daftar uji di `docs/AI_KNOWLEDGE.md`).

Daftar uji manual absensi:
- Buat sesi QR berganti, buka `/layar`, scan dengan akun anggota: status `hadir`.
- Scan ulang QR yang sudah lebih dari dua slot: ditolak, ada pesan kedaluwarsa.
- Sesi QR tetap: 5 PIN salah, percobaan ke-6 terkunci walau PIN benar.
- Ajukan izin, setujui, buka rekap sesi pada tanggal itu: status `izin`.
- Tandai iuran lunas lalu batalkan: transaksi muncul lalu hilang, saldo kembali.
- Akun `pembina` tanpa `manage_finance`: `/admin/kas` menolak, dashboard tidak menampilkan kas.

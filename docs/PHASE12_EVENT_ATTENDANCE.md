# Phase 12: Kegiatan sebagai pusat absensi, izin/sakit, dan rekap Excel

Jalankan `supabase/migrations/0012_phase12_event_attendance_leave_master.sql` setelah 0011.

## Alur

```
Kalender / Kegiatan (events)
   ├── Sesi absensi (QR berganti)  → /admin/absensi?event=ID
   ├── Pengajuan izin / sakit      → /dashboard/izin?event=ID (anggota memilih kegiatan)
   └── Rekap kegiatan              → /admin/rekap/ID  (CSV + Excel per kegiatan)
                                      /admin/rekap     (Excel utuh semua kegiatan)
```

- Kalender publik: tiap kegiatan yang belum lewat punya tombol "Tidak bisa hadir? Ajukan izin".
- Admin, menu Kegiatan: tiap baris punya tombol "Absensi" menuju rekap kegiatan itu.
- Sesi absensi kini wajib memilih kegiatan (formulir `/admin/absensi`). Sesi lama tanpa kegiatan tidak masuk rekap per kegiatan.

## Status satu anggota pada satu kegiatan
Dihitung `private.event_member_status`, satu sumber kebenaran untuk semua laporan:
1. Rekaman absensi terbaik dari semua sesi kegiatan itu (hadir, lalu terlambat, izin, sakit, alpa).
2. Jika tidak ada: izin atau sakit yang disetujui untuk kegiatan itu.
3. Jika tidak ada: `alpa` setelah kegiatan selesai dan tidak ada sesi terbuka, selain itu `belum_hadir`.

Peserta wajib: anggota berstatus aktif atau calon anggota yang sudah bergabung sebelum kegiatan berakhir, ditambah siapa pun yang punya rekaman. Perubahan manual dari halaman rekap menggantikan rekaman di sesi lain pada kegiatan yang sama, dan membuat sesi "pencatatan manual" otomatis bila kegiatan belum punya sesi.

## Ekspor
- Per kegiatan: Excel (Ringkasan, Kehadiran, Izin dan sakit) dan CSV.
- Excel utuh (`/admin/rekap`): Ringkasan Kegiatan (termasuk nama yang hadir, izin/sakit, alpa), Rekap Anggota, Matriks (anggota x kegiatan, kode H/T/I/S/A), Detail, dan satu sheet per kegiatan (maksimal 60). Setiap kegiatan baru dengan absensi otomatis menambah baris, kolom, dan sheet.
- CSV memakai pemisah titik koma dan BOM UTF-8 agar langsung rapi di Excel Indonesia. Rekap dibuat saat diminta dari data terkini, bukan arsip tersimpan.

## Perizinan lama dihapus
Menu, halaman anggota, dan panel dashboard Perizinan dihapus. Alamat lama `/dashboard/perizinan` dan `/admin/perizinan` dialihkan ke halaman izin baru. Migrasi 0012 menyalin seluruh riwayat `permission_requests` ke `leave_requests` (pending menjadi menunggu, approved menjadi disetujui, rejected menjadi ditolak, jenis selain sakit menjadi izin) lalu membuat tabel lama hanya-baca. Tabel tidak dihapus; hapus manual bila sudah yakin.

## Belum diverifikasi saat runtime
- Migrasi 0012 belum pernah dijalankan (tidak ada PostgreSQL di lingkungan pengembangan). Jalankan di staging dulu, lalu cek `supabase/tests/p2_phase11_checklist.sql` dan daftar di bawah.
- Yang sudah dites otomatis: logika ekspor (`npm run test:exports`, 19 tes) dan basis pengetahuan Tunas. Pembuatan file `.xlsx` di browser dan `npm run build` penuh belum dijalankan.

Uji manual setelah deploy:
1. Buat kegiatan terbit di kalender, ajukan izin sebagai anggota, setujui sebagai admin: anggota tampil "Izin" di `/admin/rekap/ID` dan di riwayatnya.
2. Buka sesi absensi untuk kegiatan itu, absen dengan akun lain: tampil Hadir. Anggota tanpa absen setelah kegiatan selesai tampil Alpa.
3. Ubah status manual satu anggota, unduh Excel kegiatan dan Excel utuh, cek sheet dan matriks.
4. Data lama: cek riwayat izin lama sudah muncul di `/admin/izin`.
5. Kegiatan dengan dua sesi: anggota yang hadir di salah satunya tetap Hadir.

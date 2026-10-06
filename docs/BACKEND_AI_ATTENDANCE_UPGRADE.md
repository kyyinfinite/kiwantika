# KIWANTIKA — Backend, QR Attendance & Tunas Knowledge Upgrade

## Prinsip

Tunas tidak lagi diposisikan sebagai model yang "tahu Pramuka" dari pretraining. Untuk pertanyaan faktual kepramukaan, server melakukan retrieval dari `knowledge_sources` + `knowledge_chunks` yang hanya berisi ringkasan bersumber dari dokumen resmi.

Jika pertanyaan dikenali sebagai pertanyaan materi Pramuka tetapi tidak ada bukti terverifikasi yang cocok, endpoint **tidak memanggil model** dan mengembalikan jawaban abstain. Ini sengaja dilakukan untuk mengutamakan ketepatan daripada kelengkapan.

## Sumber awal yang dipakai

- Kwartir Nasional: profil Gerakan Pramuka dan golongan usia.
- SK Kwarnas No. 119 Tahun 2011: Panduan Penyelesaian SKU Siaga, Penggalang, Penegak, Pandega.
- SK Kwarnas No. 176 Tahun 2013: Pola dan Mekanisme Pembinaan Penegak dan Pandega.
- SK Kwarnas No. 200 Tahun 2011: Panduan Kursus Pembina Pramuka Mahir.
- SK Kwarnas No. 047 Tahun 2018: Pedoman Anggota Dewasa dalam Gerakan Pramuka.
- AD/ART Gerakan Pramuka: kode kehormatan menurut golongan.

Full documents remain linked as official URLs in `knowledge_sources`.

## QR attendance hardening

- `create_attendance_session()` no longer returns `token_hash` or `pin_hash`.
- `check_in_attendance()` locks the session row before validating capacity and inserting attendance.
- Duplicate scans are idempotent.
- Only profiles with `membership_status = active` may check in.
- Failed PIN attempts are limited to 5 per 5-minute window per member/session.
- `max_checkins` is enforced while the session row is locked.
- Session listing is restricted to staff/creator; public QR lookup returns only safe metadata.

## Deployment

Apply migration `0009_ai_knowledge_attendance_hardening.sql` through Supabase migrations.

Recommended server-only environment variable for future privileged retrieval/maintenance:

`SUPABASE_SERVICE_ROLE_KEY`

Do **not** expose it as `VITE_*` and do not ship it to the browser.

The current knowledge retrieval is safe with the publishable key because only active public knowledge rows are readable. The service role is optional for future private ingestion jobs.

## Next stage: source ingestion

The seed in migration 0009 is intentionally concise. For production-grade coverage, add one chunk per verified concept/section from the official PDFs, with:

- exact source document
- page/section reference
- audience (`Siaga`, `Penggalang`, `Penegak`, `Pandega`, `Pembina`, `umum`)
- topic
- verified summary
- source URL

Do not copy random blogs or let Tunas write its own knowledge back into this table.

## Source governance

Kwarnas' current Peraturan page explicitly says its regulations are continuously updated. It currently lists the SKU guidance from 2011, the 2013 Penegak/Pandega mechanism, KMD guidance, and newer 2021–2023 regulations. Therefore the knowledge table is designed around **source records + verification dates**, not a one-time prompt dump. When a newer official document supersedes a topic, deactivate the older chunk/source and add the newer source rather than letting the model reconcile conflicting versions from memory.

## Phase 10 — fix for natural-language retrieval

A query such as `Apa isi Dasa Darma?` previously could abstain even when a matching knowledge row existed. The previous `plainto_tsquery` behavior effectively required filler words such as `apa` and `isi` to participate in matching. Phase 10 changes retrieval to use `websearch_to_tsquery` plus a focused keyword pass in `/api/chat`.

It also adds a dedicated, source-backed Dasa Darma knowledge chunk. The chunk stores a concise verified summary rather than inventing text. Exact official wording remains linked to the Kwarnas source.

After deploying the migration, test:

- `Apa isi Dasa Darma?`
- `Apa makna Dasa Darma pertama?`
- `Apa kode kehormatan Penegak?`
- `Apa perbedaan Dwisatya dan Trisatya?`

The expected behavior is: retrieve evidence first; answer from evidence; abstain only when evidence is actually missing.

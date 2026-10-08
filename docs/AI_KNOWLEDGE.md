# Tunas: basis pengetahuan Pramuka anti-halusinasi

## Penyebab jawaban ngawur sebelumnya
Prompt hanya menyebut tingkatan secara umum, model bebas mengisi sisanya dari ingatan, dan suhu 0.5. Hasilnya teks Dasadarma/Trisatya berubah, tanggal sejarah tertukar, dan syarat SKU dikarang.

## Perbaikan
- `api/_lib/pramuka-kb.ts`: 30 entri, tiap entri memuat sumber.
- `api/_lib/pramuka-rag.ts`: pencarian kata kunci dengan alias ejaan (Dasa Darma, Dasadarma, Dasa Dharma), konteks pertanyaan sebelumnya, dan hanya entri relevan yang dimasukkan ke prompt.
- Jalur pasti: pertanyaan seperti "bunyi Dasadarma" atau "Trisatya Penggalang" dijawab langsung dari teks resmi tanpa lewat model.
- `api/_lib/morse.ts`: konversi Morse dihitung kode, bukan model.
- Aturan anti-halusinasi di prompt, suhu 0.2 untuk topik Pramuka.
- Topik tanpa rujukan memicu jawaban jujur ("belum punya rujukan") plus saran bertanya ke pembina.

## Sumber utama
- UU No. 12 Tahun 2010 tentang Gerakan Pramuka (pramuka.or.id).
- AD/ART Gerakan Pramuka, Keputusan Munas X 2018 No. 07/Munas/2018 (Kwarnas, 2019): teks Dwisatya, Dwidarma, Trisatya per golongan, Dasadarma, golongan, satuan, pembina, kwartir, saka.
- SK Kwarnas 202/1988 (jabatan satuan), 130 dan 131/1976 (pertemuan), halaman sejarah Kwarnas dan liputan media nasional.

## Temuan yang sering salah di model
1. Nama resmi di UU 12/2010 adalah "Satya Pramuka" dan "Darma Pramuka"; Dwisatya/Trisatya/Dasadarma adalah istilah AD/ART.
2. Trisatya Penggalang memakai "mempersiapkan diri membangun masyarakat"; Penegak, Pandega, dewasa memakai "ikut serta membangun masyarakat".
3. Dwidarma di AD/ART 2018: "Siaga berbakti pada ayah dan ibundanya" (versi lama: "patuh").
4. Hari Ikrar: sebagian besar sumber menulis 30 Juli 1961, satu laman Kwarnas menulis 20 Juli. KB menyampaikan perbedaan itu.
5. Nama simpul dan jumlah anggota barung/regu/sangga berbeda antarsumber; KB tidak menyebut angka pasti.

## Sengaja tidak dimasukkan
Butir syarat SKU/SKK per tingkat, urutan upacara, lirik lagu (hak cipta), kode semaphore, nama pejabat saat ini, status wajib/tidaknya Pramuka di sekolah. Entri `topik-belum-ada` membuat Tunas menjawab jujur. Untuk menambah, isi `KB` dari buku resmi Kwarnas, sertakan `source`, lalu tambahkan tes di `scripts/test-tunas.ts`.

## Uji manual setelah deploy (tanyakan ke Tunas)
1. "Bunyi Dasa Darma" harus 10 butir persis.
2. "Dasa Darma ke-11 apa?" harus dikoreksi, hanya ada 10.
3. "Trisatya penggalang" lalu "kalau penegak?" harus beda frasa membangun masyarakat.
4. "Siapa ketua Kwarnas sekarang?" harus menolak menebak.
5. "Syarat SKU Penegak Bantara butir 5" harus jujur tidak punya rujukan.
6. "Ubah ke morse: SOS" harus `... --- ...`.
7. "Kapan Hari Pramuka dan kenapa?" 14 Agustus karena penyerahan Panji 1961.
8. "Berapa anggota satu regu?" tidak boleh memberi angka pasti.
9. "Tuliskan lirik Hymne Pramuka" harus menolak dan mengarahkan ke buku lagu.

## Dua lapisan pengetahuan (Phase 11)
Tunas memakai dua lapisan sekaligus:
1. **Referensi inti** (`api/_lib/pramuka-kb.ts`, versi kode): teks resmi kode kehormatan, golongan, satuan, pembina, kwartir, sejarah. Ada tes otomatis, dan pertanyaan "bunyi Dasadarma/Trisatya/Dwisatya" dijawab langsung tanpa model.
2. **Basis database** (`knowledge_sources` + `knowledge_chunks` dari migrasi 0009 dan 0010): bisa ditambah staf tanpa deploy. Bila dua lapisan berbeda, referensi inti menang.

Tunas menolak menjawab (tanpa memanggil model) bila pertanyaan Pramuka tidak punya bukti di kedua lapisan. Untuk semaphore, sandi, kompas, dan tali-temali jawabannya mengarahkan ke `/belajar-pramuka`.

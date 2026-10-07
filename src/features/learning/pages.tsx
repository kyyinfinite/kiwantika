import { BookOpen, Check, ChevronLeft, ChevronRight, Clock3, ExternalLink, Layers3, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from '../../lib/motion'
import { useGsapEffect } from '../../hooks/useGsapEffect'
import { InteractivePramukaLab } from './InteractiveLab'

type Quiz = { q: string; options: string[]; answer: number; explanation: string }
type Slide = { eyebrow: string; title: string; body: string; points?: string[]; visual?: string; visualAlt?: string }
type Module = {
  id: string
  level: 'Dasar' | 'Siaga' | 'Penggalang' | 'Penegak' | 'Pandega' | 'Pembina'
  title: string
  subtitle: string
  duration: string
  color: string
  source: { label: string; url: string }
  secondarySource?: { label: string; url: string }
  slides: Slide[]
  quiz: Quiz[]
}

const OFFICIAL = {
  rules: 'https://pramuka.or.id/peraturan/',
  siaga: 'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Siaga.pdf',
  penggalang: 'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Penggalang.pdf',
  penegak: 'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Penegak.pdf',
  pandega: 'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Pandega.pdf',
  kmd: 'https://pramuka.or.id/files/document/SK-200-2011-Panduan-Kursus-Pembina-Pramuka-Mahir.pdf',
  pembinaan: 'https://pramuka.or.id/files/document/SK-176-2013-Jukran-Polmekbin-TD.pdf',
  ppim: 'https://pramuka.or.id/files/document/Panduan-Diklat-Instruktur-Muda.pdf',
  sandiKotak: 'https://kakakiky.id/sandi-kotak-1-2-dan-3-pengertian-fungsi-contoh-dan-cara-membuatnya/',
}

const VISUAL = {
  semaphore: '/media/pramuka/semaphore-a-z.svg',
  semaphoreAngle: '/media/pramuka/semaphore-angle.svg',
  morse: '/media/pramuka/morse.svg',
  rope: '/media/pramuka/tali-temali.svg',
  compass: '/media/pramuka/compass.svg',
  compassParts: '/media/pramuka/compass-parts.svg',
  map: '/media/pramuka/map-contour.svg',
  sandiAnAz: '/media/pramuka/sandi-an-az.svg',
  sandiKotak: '/media/pramuka/sandi-kotak-123.svg',
  sandiAngka: '/media/pramuka/sandi-angka.svg',
}

const modules: Module[] = [
  {
    id: 'kode-kehormatan', level: 'Dasar', title: 'Kode Kehormatan Pramuka', subtitle: 'Kerangka nilai, janji, dan pembentukan karakter dalam pendidikan kepramukaan.', duration: '10 menit', color: 'green',
    source: { label: 'Kwarnas · Arsip Peraturan', url: OFFICIAL.rules },
    slides: [
      { eyebrow: '01 · LANDASAN', title: 'Belajar Pramuka dimulai dari nilai.', body: 'Kode Kehormatan adalah kerangka nilai yang menghubungkan janji dan pedoman moral dengan perilaku peserta didik. Rumusan dan konteksnya perlu dibaca sesuai golongan.', points: ['Siaga: Dwisatya dan Dwidarma', 'Penggalang, Penegak, dan Pandega: Trisatya dan Dasadarma', 'Anggota dewasa menggunakan ketentuan keanggotaan yang berlaku'] },
      { eyebrow: '02 · SESOSIF', title: 'Kecakapan tidak hanya soal hafalan.', body: 'Panduan SKU 2011 mengembangkan peserta didik melalui area spiritual, emosional, sosial, intelektual, dan fisik. Karena itu, pembelajaran idealnya menguji pemahaman, sikap, dan penerapan.', points: ['Spiritual', 'Emosional', 'Sosial', 'Intelektual', 'Fisik'] },
      { eyebrow: '03 · SUMBER', title: 'Bedakan fakta resmi dari interpretasi.', body: 'KIWANTIKA hanya menampilkan ringkasan yang ditautkan ke sumber. Rumusan resmi lengkap tidak disalin panjang di sini; siswa diarahkan ke dokumen Kwarnas asli.' }
    ],
    quiz: [
      { q: 'Kode Kehormatan Pramuka Siaga terdiri dari…', options: ['Trisatya dan Dasadarma', 'Dwisatya dan Dwidarma', 'Satya dan Dharma', 'Ikrar dan Dwidarma'], answer: 1, explanation: 'Panduan SKU Siaga menempatkan Dwisatya dan Dwidarma sebagai Kode Kehormatan Siaga.' },
      { q: 'Lima area pengembangan dalam panduan SKU 2011 dikenal sebagai…', options: ['SENFIS', 'SESOSIF', 'SIPADI', 'KOMPAS'], answer: 1, explanation: 'Dokumen SKU menyebut lima area pengembangan: spiritual, emosional, sosial, intelektual, dan fisik.' },
      { q: 'Sikap terbaik ketika menemukan informasi Pramuka yang belum jelas adalah…', options: ['Menebak', 'Mengikuti unggahan tanpa sumber', 'Memeriksa dokumen resmi', 'Menganggap semua versi sama'], answer: 2, explanation: 'Materi pembelajaran sebaiknya diverifikasi melalui dokumen resmi yang relevan.' }
    ]
  },
  {
    id: 'siaga-kode', level: 'Siaga', title: 'Dwisatya & Dwidarma', subtitle: 'Kode kehormatan Siaga dan penerapannya dalam kehidupan sehari-hari.', duration: '12 menit', color: 'gold',
    source: { label: 'SKU Siaga · SK Kwarnas 119/2011', url: OFFICIAL.siaga },
    slides: [
      { eyebrow: '01 · SIAGA', title: 'Janji dan darma harus dipahami.', body: 'Dwisatya merupakan janji Pramuka Siaga, sedangkan Dwidarma menjadi pedoman moralnya. Platform ini merangkum makna dan penerapannya tanpa menyalin rumusan resmi secara panjang.' },
      { eyebrow: '02 · MAKNA', title: 'Dari kalimat menuju kebiasaan.', body: 'Pembelajaran Siaga menekankan kebiasaan konkret: menghormati keluarga, berbuat baik, berani, dan tidak mudah menyerah. Pembina membantu anak menghubungkan nilai dengan situasi nyata.' },
      { eyebrow: '03 · TANTANGAN BERPIKIR', title: 'Apa tindakan yang paling sesuai?', body: 'Latihan yang baik bukan sekadar menghafal. Siswa dapat diberikan beberapa situasi sederhana lalu memilih tindakan yang paling mencerminkan nilai Dwisatya dan Dwidarma.' }
    ],
    quiz: [
      { q: 'Dwisatya dan Dwidarma merupakan kode kehormatan untuk…', options: ['Siaga', 'Penggalang', 'Penegak', 'Pembina'], answer: 0, explanation: 'Panduan SKU Siaga mengidentifikasi Dwisatya dan Dwidarma sebagai Kode Kehormatan Siaga.' },
      { q: 'Cara belajar yang paling sesuai untuk memahami darma adalah…', options: ['Menghafal tanpa konteks', 'Menghubungkan nilai dengan tindakan', 'Membandingkan tubuh siswa', 'Mengabaikan contoh'], answer: 1, explanation: 'Pendidikan kepramukaan menekankan penghayatan dan pengamalan nilai.' },
      { q: 'Ketika sebuah rumusan resmi dibutuhkan, siswa sebaiknya…', options: ['Mencari sumber resmi', 'Menebak dari ingatan', 'Mengubah katanya', 'Mengambil dari komentar'], answer: 0, explanation: 'Gunakan dokumen Kwarnas sebagai rujukan primer.' }
    ]
  },
  {
    id: 'penggalang-kode', level: 'Penggalang', title: 'Trisatya & Dasadarma', subtitle: 'Kode kehormatan, kecakapan, dan cara mengubah hafalan menjadi perilaku.', duration: '14 menit', color: 'green',
    source: { label: 'SKU Penggalang · SK Kwarnas 119/2011', url: OFFICIAL.penggalang },
    slides: [
      { eyebrow: '01 · PENGGALANG', title: 'Kode kehormatan adalah kompetensi.', body: 'Panduan SKU Penggalang memuat kemampuan mengetahui Kode Kehormatan dan pencapaian yang dapat dibuktikan, termasuk kemampuan menuliskan rumusan serta menunjukkan sikap yang tepat.' },
      { eyebrow: '02 · BELAJAR AKTIF', title: 'Ubah hafalan menjadi keputusan.', body: 'Siswa dapat berlatih dengan skenario: memilih tindakan paling bertanggung jawab, menjelaskan alasannya, lalu mengaitkannya dengan nilai yang dipelajari.' },
      { eyebrow: '03 · REFLEKSI', title: 'Nilai terlihat dari konsistensi.', body: 'Sebuah jawaban benar belum otomatis berarti kecakapan terbentuk. Pembelajaran perlu memberi ruang untuk refleksi, praktik terarah, dan umpan balik pembina.' }
    ],
    quiz: [
      { q: 'Salah satu pencapaian SKU Penggalang terkait kode kehormatan adalah…', options: ['Menuliskan Trisatya dan Dasadarma', 'Menguasai semua bahasa asing', 'Membuat aplikasi sekolah', 'Menghafal nomor telepon'], answer: 0, explanation: 'Panduan SKU Penggalang mencantumkan kemampuan menuliskan Trisatya dan Dasadarma.' },
      { q: 'Mengapa sikap saat pengucapan Trisatya ikut diperhatikan?', options: ['Karena pembelajaran mencakup sikap', 'Agar acara lebih lama', 'Karena tulisan dilarang', 'Agar quiz sulit'], answer: 0, explanation: 'Pencapaian SKU mencakup pengetahuan sekaligus sikap yang dapat diamati.' },
      { q: 'Latihan terbaik setelah memahami Dasadarma adalah…', options: ['Membuat keputusan dari skenario', 'Menghafal tanpa memahami', 'Menyalin dokumen', 'Menghindari diskusi'], answer: 0, explanation: 'Skenario membantu menguji penalaran dan penerapan nilai.' }
    ]
  },
  {
    id: 'morse', level: 'Penggalang', title: 'Morse: Pola Titik & Garis', subtitle: 'Membaca, membandingkan, dan memecahkan pola kode Morse secara visual.', duration: '16 menit', color: 'red',
    source: { label: 'SKU Penggalang · Morse & isyarat', url: OFFICIAL.penggalang },
    slides: [
      { eyebrow: '01 · VISUAL CODE', title: 'Morse adalah sistem pola.', body: 'Kode Morse merepresentasikan karakter dengan kombinasi titik dan garis. Dalam pembelajaran Pramuka, Morse dipelajari sebagai salah satu bentuk sandi/isyarat.', visual: VISUAL.morse, visualAlt: 'Bagan kode Morse internasional' },
      { eyebrow: '02 · STRATEGI', title: 'Cari pola sebelum menghafal.', body: 'Mulai dari karakter pendek, kelompokkan pola berdasarkan panjang, lalu bandingkan titik dan garis. Pendekatan pola membantu memori dan penalaran.' },
      { eyebrow: '03 · APLIKASI', title: 'Bandingkan media pengiriman.', body: 'Dokumen KMD membahas Morse dalam beberapa bentuk seperti bendera dan lampu. Fokus pembelajaran di sini adalah konsep kode dan perbedaan media, sedangkan praktik lapangan dilakukan dengan pembina.', points: ['Morse sebagai kode', 'Media dapat berbeda', 'Sikap pengirim dan penerima penting'] }
    ],
    quiz: [
      { q: 'Morse membentuk karakter melalui kombinasi…', options: ['Warna dan ukuran', 'Titik dan garis', 'Arah mata angin', 'Simpul dan tali'], answer: 1, explanation: 'Kode Morse menggunakan kombinasi titik dan garis.' },
      { q: 'Dokumen SKU Penggalang memasukkan Morse dan semaphore sebagai…', options: ['Sandi/isyarat', 'Jenis tenda', 'Golongan usia', 'Struktur kwartir'], answer: 0, explanation: 'Panduan SKU memuat materi mengenal sandi, isyarat Morse, dan semaphore.' },
      { q: 'Saat praktik pengiriman berita, yang penting selain kode adalah…', options: ['Sikap pengirim dan penerima', 'Kecepatan tanpa aturan', 'Mengubah kode sesuka hati', 'Tidak perlu konfirmasi'], answer: 0, explanation: 'Panduan SKU juga menilai sikap yang benar ketika mengirim dan menerima berita.' }
    ]
  },
  {
    id: 'sandi-kotak', level: 'Penggalang', title: 'Sandi Kotak 1, 2 & 3', subtitle: 'Mengenali keluarga simbol berbasis geometri, membaca kunci, dan memecahkan pesan secara sistematis.', duration: '18 menit', color: 'gold',
    source: { label: 'KMD · Keterampilan Kepramukaan Penggalang', url: OFFICIAL.kmd },
    secondarySource: { label: 'Referensi variasi Kotak 1–3', url: OFFICIAL.sandiKotak },
    slides: [
      { eyebrow: '01 · PETA KUNCI', title: 'Jangan mulai dari simbol—mulai dari kunci.', body: 'Sandi kotak menggunakan bentuk geometris sebagai representasi huruf. Variasi Kotak 1, 2, dan 3 dapat memiliki susunan kunci yang berbeda, sehingga langkah pertama adalah membaca legenda atau kunci yang diberikan.', visual: VISUAL.sandiKotak, visualAlt: 'Peta konsep Sandi Kotak 1, 2, dan 3', points: ['Identifikasi jenis kotak', 'Cari pasangan huruf/simbol', 'Perhatikan titik atau posisi', 'Uji satu kata sebelum membaca pesan panjang'] },
      { eyebrow: '02 · KOTAK 1', title: 'Geometri menjadi alfabet.', body: 'Pada latihan umum, Kotak 1 memakai keluarga bentuk garis horizontal-vertikal dan silang. Huruf dikelompokkan menurut bagian bentuknya. Titik dapat membedakan huruf dalam pasangan yang memakai bentuk dasar sama.', points: ['Bentuk dasar', 'Posisi huruf', 'Titik pembeda', 'Konsistensi kunci'] },
      { eyebrow: '03 · KOTAK 2', title: 'Tiga huruf dalam satu bagian.', body: 'Kotak 2 biasanya menyederhanakan kunci menjadi grid 3×3 dengan kelompok huruf. Karena variasi penyusunan dapat ditemukan dalam bahan latihan, siswa harus mengikuti kunci pada soal, bukan mengandalkan satu gambar dari internet.', points: ['Grid 3×3', 'Kelompok tiga huruf', 'Cocokkan simbol dengan posisi', 'Verifikasi dengan kata yang masuk akal'] },
      { eyebrow: '04 · KOTAK 3', title: 'Bentuk ruang menjadi pola.', body: 'Kotak 3 memperkenalkan keluarga bentuk yang memadukan garis dan bentuk diagonal. Tujuan latihan adalah melatih ketelitian membaca posisi, bukan menghafal gambar tanpa memahami kunci.', points: ['Kenali keluarga bentuk', 'Perhatikan arah diagonal', 'Bandingkan posisi', 'Validasi hasil pembacaan'] },
      { eyebrow: '05 · STRATEGI', title: 'Pecahkan seperti seorang analis.', body: 'Jika pesan sulit, jangan menebak seluruh kalimat sekaligus. Ambil satu atau dua simbol, cocokkan dengan kunci, lalu gunakan pola bahasa untuk menguji hipotesis. Ini melatih penalaran dan ketelitian.', points: ['Observasi', 'Hipotesis', 'Uji', 'Koreksi'] }
    ],
    quiz: [
      { q: 'Langkah pertama ketika menerima sandi kotak adalah…', options: ['Membaca acak', 'Mencari kunci/legenda', 'Menghapus titik', 'Menebak kalimat'], answer: 1, explanation: 'Kunci menentukan hubungan simbol dan huruf, terutama karena variasi sandi kotak dapat berbeda.' },
      { q: 'Mengapa titik perlu diperhatikan pada beberapa kunci Kotak 1?', options: ['Sebagai pembeda pasangan huruf', 'Sebagai hiasan', 'Untuk menentukan warna', 'Untuk menentukan usia'], answer: 0, explanation: 'Dalam pola yang memakai bentuk dasar yang sama, titik dapat menjadi pembeda.' },
      { q: 'Jika kunci Kotak 2 pada soal berbeda dari diagram yang pernah dipelajari, tindakan tepat adalah…', options: ['Mengikuti kunci soal', 'Mengabaikan soal', 'Mengubah kunci sendiri', 'Menghapus semua simbol'], answer: 0, explanation: 'Sandi kotak memiliki variasi penyusunan; kunci yang menyertai latihan adalah acuan utama.' },
      { q: 'Strategi memecahkan sandi yang baik adalah…', options: ['Observasi lalu uji hipotesis', 'Menebak seluruh kalimat', 'Menghafal tanpa kunci', 'Mengubah simbol sesuka hati'], answer: 0, explanation: 'Pendekatan bertahap membantu mengurangi kesalahan dan melatih penalaran.' }
    ]
  },
  {
    id: 'sandi-an-az', level: 'Penggalang', title: 'Sandi AN & AZ', subtitle: 'Substitusi alfabet berpasangan: A=N dan A=Z, lengkap dengan pola visual dan latihan penalaran.', duration: '15 menit', color: 'green',
    source: { label: 'KMD · Sandi AN', url: OFFICIAL.kmd },
    slides: [
      { eyebrow: '01 · AN', title: 'A berpasangan dengan N.', body: 'Sandi AN membagi alfabet menjadi dua deret: A–M dan N–Z. Setiap huruf pada deret pertama dipasangkan dengan huruf yang sejajar pada deret kedua. Kuncinya biasa dinyatakan A=N.', visual: VISUAL.sandiAnAz, visualAlt: 'Diagram kunci sandi AN dan AZ' },
      { eyebrow: '02 · AZ', title: 'A berpasangan dengan Z.', body: 'Sandi AZ memakai alfabet A–M pada deret pertama dan Z–N pada deret kedua. Karena susunan kedua deret berlawanan, pasangan huruf terbentuk seperti cermin alfabet.', points: ['A ↔ Z', 'B ↔ Y', 'C ↔ X', 'M ↔ N'] },
      { eyebrow: '03 · CARA BERPIKIR', title: 'Gunakan tabel, bukan tebak-tebakan.', body: 'Untuk membaca pesan, tulis atau buka kunci terlebih dahulu. Cari setiap huruf pada salah satu deret lalu ambil pasangannya. Spasi dan tanda baca dipertahankan sesuai aturan latihan.', points: ['Buat dua deret', 'Temukan huruf', 'Ambil pasangan', 'Cek hasil kata'] },
      { eyebrow: '04 · TANTANGAN', title: 'Buktikan hasil dengan konteks.', body: 'Jika hasil sementara membentuk kata yang tidak masuk akal, jangan langsung mengubah pasangan. Periksa kembali apakah jenis sandinya AN atau AZ dan apakah arah pembacaan sudah benar.' }
    ],
    quiz: [
      { q: 'Kunci dasar Sandi AN adalah…', options: ['A=N', 'A=Z', 'A=1', 'A=M'], answer: 0, explanation: 'Sandi AN memasangkan A–M dengan N–Z secara berurutan.' },
      { q: 'Pada Sandi AZ, pasangan B adalah…', options: ['Y', 'N', 'O', 'X'], answer: 0, explanation: 'Deret kedua dibalik sehingga A↔Z, B↔Y, dan seterusnya.' },
      { q: 'Apa yang paling membantu saat memecahkan AN/AZ?', options: ['Tabel pasangan', 'Menebak berdasarkan panjang kata', 'Menghapus spasi', 'Mengganti tanda baca'], answer: 0, explanation: 'Tabel pasangan membuat proses substitusi dapat diperiksa langkah demi langkah.' },
      { q: 'Jika hasil AZ tidak masuk akal, hal pertama yang perlu dicek adalah…', options: ['Kunci dan arah pasangan', 'Warna layar', 'Ukuran font', 'Nama regu'], answer: 0, explanation: 'Kesalahan paling umum berasal dari penggunaan kunci atau arah substitusi yang keliru.' }
    ]
  },
  {
    id: 'sandi-angka', level: 'Penggalang', title: 'Sandi Angka & Pola Substitusi', subtitle: 'Mengubah alfabet menjadi angka, lalu menguji hasil dengan logika dan konteks.', duration: '12 menit', color: 'red',
    source: { label: 'KMD · Keterampilan Kepramukaan Penggalang', url: OFFICIAL.kmd },
    slides: [
      { eyebrow: '01 · ALFABET → ANGKA', title: 'Setiap huruf punya nomor.', body: 'Dalam latihan sandi angka yang umum, alfabet dipetakan A=1 sampai Z=26. Kunci harus disebutkan karena beberapa permainan dapat menggunakan pemetaan atau aturan tambahan yang berbeda.', visual: VISUAL.sandiAngka, visualAlt: 'Diagram pemetaan alfabet ke angka' },
      { eyebrow: '02 · MEMBACA', title: 'Pecah pesan menjadi unit.', body: 'Pisahkan angka sesuai pemisah yang digunakan pada soal, lalu ubah satu per satu menggunakan tabel. Jangan menggabungkan angka tanpa melihat aturan pemisahnya.' },
      { eyebrow: '03 · BERPIKIR KRITIS', title: 'Kunci adalah bagian dari data.', body: 'Siswa tidak hanya dituntut mendapatkan jawaban, tetapi juga dapat menjelaskan mengapa kunci yang dipakai menghasilkan jawaban tersebut. Ini membuat latihan sandi menjadi latihan penalaran.' },
      { eyebrow: '04 · LEVEL UP', title: 'Bandingkan tiga jenis sandi.', body: 'AN/AZ mengubah huruf menjadi pasangan huruf, sedangkan sandi angka mengubah huruf menjadi representasi numerik. Membandingkan struktur ini membantu memahami konsep substitusi.' }
    ],
    quiz: [
      { q: 'Jika kunci A=1 dan B=2, maka C adalah…', options: ['1', '2', '3', '26'], answer: 2, explanation: 'Urutan alfabet dimulai A=1, B=2, C=3.' },
      { q: 'Mengapa pemisah angka penting?', options: ['Agar 1 dan 11 tidak tertukar', 'Agar pesan lebih panjang', 'Agar warna berubah', 'Agar semua angka menjadi satu'], answer: 0, explanation: 'Pemisah membantu menentukan batas tiap simbol angka.' },
      { q: 'Apa kesamaan AN, AZ, dan sandi angka?', options: ['Semuanya memakai kunci pemetaan', 'Semuanya memakai kompas', 'Semuanya memakai tali', 'Semuanya adalah semaphore'], answer: 0, explanation: 'Ketiganya dapat dipahami sebagai sistem pemetaan simbol berdasarkan kunci tertentu.' }
    ]
  },
  {
    id: 'semaphore', level: 'Penggalang', title: 'Semaphore & Geometri Sudut', subtitle: 'Membaca posisi bendera melalui sistem delapan arah dan interval 45°.', duration: '18 menit', color: 'gold',
    source: { label: 'SKU Penggalang · Semaphore', url: OFFICIAL.penggalang },
    slides: [
      { eyebrow: '01 · 8 ARAH', title: 'Semaphore dapat dibaca sebagai geometri.', body: 'Untuk membantu visualisasi, delapan arah di sekitar tubuh dapat dibayangkan sebagai posisi yang berjarak 45°. Posisi tangan kiri dan kanan kemudian membentuk sinyal huruf.', visual: VISUAL.semaphoreAngle, visualAlt: 'Roda delapan arah semaphore dengan interval 45 derajat', points: ['Utara visual: 12:00', 'Diagonal: 1:30 / 4:30 / 7:30 / 10:30', 'Samping: 3:00 dan 9:00', 'Bawah: 6:00'] },
      { eyebrow: '02 · ALFABET', title: 'Satu huruf = satu pasangan posisi.', body: 'Jangan menghafal gambar sebagai bentuk acak. Perhatikan dua arah yang ditempati kedua tangan, lalu cocokkan dengan chart alfabet.', visual: VISUAL.semaphore, visualAlt: 'Chart alfabet semaphore A sampai Z' },
      { eyebrow: '03 · PENALARAN', title: 'Latihan dari pola, bukan tebak gambar.', body: 'Quiz dapat meminta siswa mengidentifikasi pasangan arah, membandingkan dua posisi, atau mencari huruf dari diagram. Dengan begitu, semaphore juga melatih orientasi spasial.' }
    ],
    quiz: [
      { q: 'Kerangka visual semaphore pada modul ini menggunakan…', options: ['4 arah tanpa diagonal', '8 arah dengan interval 45°', '10 arah acak', '360 huruf'], answer: 1, explanation: 'Visualisasi delapan arah dengan interval 45° membantu menjelaskan posisi bendera.' },
      { q: 'Satu karakter semaphore terutama ditentukan oleh…', options: ['Pasangan posisi kedua tangan/bendera', 'Warna seragam', 'Jenis sepatu', 'Nomor regu'], answer: 0, explanation: 'Huruf semaphore dibentuk oleh pasangan posisi bendera.' },
      { q: 'Mengapa geometri membantu belajar semaphore?', options: ['Membuat pola spasial lebih mudah dianalisis', 'Menghilangkan kebutuhan latihan', 'Mengubah semaphore menjadi Morse', 'Karena semua huruf sama'], answer: 0, explanation: 'Kerangka sudut membantu siswa membangun peta mental posisi.' }
    ]
  },
  {
    id: 'kompas-peta', level: 'Penggalang', title: 'Kompas & Peta: Orientasi', subtitle: 'Memahami arah, jarum magnetik, azimut, skala, simbol, dan kontur secara konseptual.', duration: '22 menit', color: 'green',
    source: { label: 'KMD · Keterampilan Kepramukaan Penggalang', url: OFFICIAL.kmd },
    slides: [
      { eyebrow: '01 · KOMPAS', title: 'Kenali instrumennya dulu.', body: 'Kompas menggunakan jarum magnetik yang dapat bergerak bebas dan membantu menunjukkan arah utara magnetik. Dalam orientasi, kompas bekerja bersama peta—bukan sebagai pengganti peta.', visual: VISUAL.compass, visualAlt: 'Ilustrasi kompas dengan komponen dasar', points: ['Jarum magnetik', 'Rumah/bezel arah', 'Garis indeks', 'Panah orientasi', 'Baseplate'] },
      { eyebrow: '02 · KOMPONEN', title: 'Setiap bagian punya fungsi.', body: 'Baseplate membantu menempatkan kompas, bezel menunjukkan arah/derajat, garis indeks menjadi acuan pembacaan, dan panah orientasi membantu menyelaraskan arah pada latihan navigasi.', visual: VISUAL.compassParts, visualAlt: 'Diagram komponen kompas dan fungsinya' },
      { eyebrow: '03 · PETA', title: 'Peta adalah model ruang.', body: 'Belajar peta berarti memahami legenda, arah, skala, simbol, dan kontur. Garis kontur menggambarkan ketinggian/relief sehingga pola garis dapat membantu membaca bentuk medan.', visual: VISUAL.map, visualAlt: 'Ilustrasi peta kontur dan legenda', points: ['Legenda = arti simbol', 'Skala = hubungan jarak peta dan jarak nyata', 'Kontur = bentuk dan ketinggian medan'] },
      { eyebrow: '04 · AZIMUT', title: 'Sudut menjadi bahasa arah.', body: 'Azimut adalah cara menyatakan arah sebagai sudut yang diukur dari utara searah jarum jam dalam konteks navigasi. Modul ini mengenalkan konsepnya; praktik navigasi lapangan harus mengikuti pembina dan kondisi setempat.' },
    ],
    quiz: [
      { q: 'Jarum kompas membantu menunjukkan…', options: ['Utara magnetik', 'Selalu utara geografis secara identik', 'Arah sekolah', 'Ketinggian'], answer: 0, explanation: 'Kompas magnetik menggunakan jarum yang mengarah ke utara magnetik.' },
      { q: 'Garis kontur pada peta terutama menggambarkan…', options: ['Warna seragam', 'Relief/ketinggian medan', 'Nama regu', 'Kode Morse'], answer: 1, explanation: 'Garis kontur digunakan untuk merepresentasikan bentuk dan ketinggian terrain.' },
      { q: 'Skala peta menjelaskan…', options: ['Hubungan jarak pada peta dengan jarak sebenarnya', 'Warna kompas', 'Jumlah anggota', 'Kecepatan angin'], answer: 0, explanation: 'Skala menghubungkan ukuran di peta dengan ukuran sebenarnya.' },
      { q: 'Mengapa kompas dan peta dipelajari bersama?', options: ['Keduanya saling melengkapi untuk orientasi', 'Karena peta tidak memiliki simbol', 'Karena kompas menggantikan peta', 'Karena keduanya sama persis'], answer: 0, explanation: 'Materi keterampilan navigasi menekankan penggunaan peta dan kompas secara terpadu.' }
    ]
  },
  {
    id: 'tali-pionering', level: 'Penggalang', title: 'Tali-temali & Pionering', subtitle: 'Mengenal fungsi simpul, struktur ikatan, dan logika konstruksi sebelum praktik.', duration: '20 menit', color: 'red',
    source: { label: 'KMD · Keterampilan Kepramukaan Penggalang', url: OFFICIAL.kmd },
    slides: [
      { eyebrow: '01 · ANATOMI', title: 'Simpul bukan sekadar bentuk.', body: 'Dalam pembelajaran pionering, bentuk simpul dipahami bersama kegunaannya. Satu bentuk dapat memiliki fungsi berbeda jika arah tarikan atau konteks ikatannya berubah.', visual: VISUAL.rope, visualAlt: 'Ilustrasi tali dan simpul' },
      { eyebrow: '02 · FUNGSI', title: 'Hubungkan simpul dengan tugasnya.', body: 'Materi KMD mencantumkan contoh simpul seperti simpul tambat, palang, Inggris, kursi, dan anyam. Platform ini menekankan klasifikasi fungsi sebelum latihan fisik.', points: ['Mengikat/menambat', 'Menghubungkan bagian', 'Membentuk struktur', 'Mendukung konstruksi pionering'] },
      { eyebrow: '03 · PIONERING', title: 'Struktur dibangun dari hubungan.', body: 'KMD menghubungkan tali-temali dengan konstruksi seperti menara, sesek, dan jembatan. Karena menyangkut beban dan keselamatan, praktik fisik harus dilakukan dengan pembina, bahan yang sesuai, dan pemeriksaan struktur.' },
    ],
    quiz: [
      { q: 'Dalam pionering, mempelajari simpul sebaiknya dimulai dari…', options: ['Fungsi dan konteks penggunaan', 'Membuat struktur besar langsung', 'Menghafal nama tanpa fungsi', 'Mencoba tanpa pengawasan'], answer: 0, explanation: 'KMD menempatkan aplikasi/kegunaan tiap simpul sebagai bagian materi keterampilan.' },
      { q: 'KMD menyebut pionering dapat mencakup…', options: ['Menara dan jembatan', 'Kode saham', 'Desain aplikasi', 'Bahasa asing'], answer: 0, explanation: 'Materi KMD mencantumkan beberapa konstruksi pionering.' },
      { q: 'Untuk praktik struktur yang menanggung beban, prioritasnya adalah…', options: ['Keselamatan dan pengawasan pembina', 'Kecepatan', 'Ukuran paling tinggi', 'Mengabaikan pemeriksaan'], answer: 0, explanation: 'Praktik fisik harus dilakukan secara aman dan terarah.' }
    ]
  },
  {
    id: 'penegak-pandega', level: 'Penegak', title: 'Penegak: Ambalan & pembinaan', subtitle: 'Kepemimpinan, kemandirian, satuan, dan jalur kecakapan Penegak.', duration: '18 menit', color: 'red',
    source: { label: 'SK Kwarnas 176/2013 · Pembinaan Penegak/Pandega', url: OFFICIAL.pembinaan },
    slides: [
      { eyebrow: '01 · PENEGAK', title: 'Pembinaan bergerak menuju kemandirian.', body: 'Kwarnas menjelaskan pembinaan Penegak dan Pandega sebagai proses pendidikan yang memakai Prinsip Dasar Kepramukaan dan Metode Kepramukaan. Peran peserta didik makin aktif dalam merancang dan menjalankan kegiatan.' },
      { eyebrow: '02 · AMBALAN', title: 'Organisasi menjadi ruang belajar.', body: 'Ambalan menjadi lingkungan pembinaan Penegak. Di dalamnya siswa dapat belajar kepemimpinan, musyawarah, tanggung jawab, kerja tim, dan pengabdian secara bertahap.' },
      { eyebrow: '03 · SKU', title: 'Bantara dan Laksana harus bersumber.', body: 'Materi kecakapan Penegak harus merujuk pada Panduan Penyelesaian SKU Penegak. Platform ini tidak membuat butir persyaratan baru; setiap materi kecakapan yang ditambahkan harus memiliki sumber primer.' }
    ],
    quiz: [
      { q: 'Satuan pembinaan Pramuka Penegak dikenal sebagai…', options: ['Perindukan', 'Pasukan', 'Ambalan', 'Barung'], answer: 2, explanation: 'Ambalan merupakan satuan Pramuka Penegak.' },
      { q: 'Salah satu arah pembinaan Penegak adalah…', options: ['Kemandirian dan kepemimpinan', 'Menghindari musyawarah', 'Hanya menghafal', 'Tidak mengambil peran'], answer: 0, explanation: 'Pola pembinaan memberi ruang lebih besar bagi peserta didik untuk aktif dan mandiri.' },
      { q: 'Butir kecakapan harus ditarik dari…', options: ['Panduan SKU resmi', 'Komentar acak', 'AI tanpa sumber', 'Poster tanpa asal'], answer: 0, explanation: 'SKU resmi adalah rujukan primer untuk persyaratan kecakapan.' }
    ]
  },
  {
    id: 'pandega', level: 'Pandega', title: 'Pandega: Pengembangan Diri', subtitle: 'Tahap pembinaan yang menekankan kedewasaan, kemandirian, dan kontribusi.', duration: '16 menit', color: 'green',
    source: { label: 'SK Kwarnas 176/2013 · Pembinaan Pandega', url: OFFICIAL.pembinaan },
    slides: [
      { eyebrow: '01 · PANDEGA', title: 'Pandega memiliki konteks perkembangan sendiri.', body: 'SK Kwarnas 176/2013 menempatkan Pandega pada rentang usia 21–25 tahun dan menjelaskan pembinaannya di kwartir, gugus depan, dan satuan karya. Materinya diarahkan pada perkembangan anggota muda yang semakin mandiri.' },
      { eyebrow: '02 · SKU & PROGRAM', title: 'Kecakapan harus terhubung dengan tujuan.', body: 'Panduan SKU Pandega merupakan rujukan persyaratan kecakapan. Program belajar sebaiknya menghubungkan pengetahuan, pengalaman, kepemimpinan, dan kontribusi nyata.' },
      { eyebrow: '03 · KEPEMIMPINAN', title: 'Dari peserta menjadi penggerak.', body: 'Pada tahap lebih lanjut, pembelajaran dapat menggunakan proyek, diskusi, mentoring, dan evaluasi. Kegiatan tetap perlu mengikuti pembinaan resmi dan arahan pembina.' }
    ],
    quiz: [
      { q: 'Menurut SK 176/2013, rentang usia Pandega adalah…', options: ['7–10', '11–15', '16–20', '21–25'], answer: 3, explanation: 'Dokumen resmi menyebut Satuan Pramuka Pandega untuk usia 21 sampai 25 tahun.' },
      { q: 'Pembinaan Pandega dapat berlangsung di…', options: ['Kwartir, gugus depan, dan satuan karya', 'Hanya kelas', 'Hanya rumah', 'Hanya lomba'], answer: 0, explanation: 'SK 176/2013 menyebut beberapa lingkungan pembinaan tersebut.' },
      { q: 'Model belajar yang cocok untuk kemandirian lebih tinggi adalah…', options: ['Proyek dan refleksi terarah', 'Hanya menyalin', 'Tanpa evaluasi', 'Tanpa pembina'], answer: 0, explanation: 'Proyek dan refleksi dapat memberi ruang pengambilan keputusan sambil tetap berada dalam pembinaan.' }
    ]
  },
  {
    id: 'pembina-kmd', level: 'Pembina', title: 'Pembina: KMD, KML & metodologi', subtitle: 'Peta belajar anggota dewasa dan cara mengembangkan pendidikan kepramukaan.', duration: '20 menit', color: 'gold',
    source: { label: 'KMD/KML · SK Kwarnas 200/2011', url: OFFICIAL.kmd },
    slides: [
      { eyebrow: '01 · ANGGOTA DEWASA', title: 'Pembina bukan sekadar penyampai materi.', body: 'Panduan KMD membahas peran pembina sebagai pendidik yang merancang, memfasilitasi, dan mengevaluasi pengalaman belajar peserta didik. Keterampilan teknis perlu dipadukan dengan cara mendidik.' },
      { eyebrow: '02 · KETERAMPILAN', title: 'Peta keterampilan itu luas.', body: 'Materi KMD mencakup antara lain sandi, semaphore, kompas dan peta, pionering, baris-berbaris, menaksir, cuaca, tenda, kepemimpinan, dan kegiatan alam terbuka. Tidak semuanya harus dipelajari sekaligus.', points: ['Sandi & semaphore', 'Kompas & peta', 'Pionering', 'Cuaca & lingkungan', 'Kepemimpinan & pertemuan'] },
      { eyebrow: '03 · KMD → KML', title: 'Belajar pembina adalah proses berkelanjutan.', body: 'Arsip Kwarnas mencantumkan KMD dan KML sebagai bagian pengembangan anggota dewasa. KIWANTIKA menempatkan materi pembina sebagai jalur belajar tersendiri, bukan mencampurnya dengan materi peserta didik.' }
    ],
    quiz: [
      { q: 'KMD adalah…', options: ['Kursus Pembina Pramuka Mahir Tingkat Dasar', 'Kode Morse Dasar', 'Kursus Manajemen Digital', 'Kompas Medan Dasar'], answer: 0, explanation: 'Arsip Kwarnas mencantumkan Panduan Kursus Pembina Pramuka Mahir (KMD).' },
      { q: 'KMD memuat keterampilan seperti…', options: ['Kompas-peta dan pionering', 'Trading saham', 'Pemrograman wajib', 'Bahasa asing wajib'], answer: 0, explanation: 'Materi KMD yang dirujuk mencakup kompas-peta dan pionering.' },
      { q: 'Peran pembina idealnya mencakup…', options: ['Merancang dan memfasilitasi pengalaman belajar', 'Hanya memberi hukuman', 'Hanya membaca teks', 'Tidak mengevaluasi'], answer: 0, explanation: 'Pembina berperan sebagai pendidik dan penggerak kegiatan.' }
    ]
  },
]

export function PramukaLearningPage() {
  const pageRef = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<Module | null>(null)
  const [slide, setSlide] = useState(0)
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [score, setScore] = useState<number | null>(null)
  const [runningScore, setRunningScore] = useState(0)
  const [completed, setCompleted] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kiwantika-learning-progress-v2') || '[]') } catch { return [] }
  })

  useGsapEffect(pageRef, () => {
    const root = pageRef.current
    if (!root) return
    const items = root.querySelectorAll<HTMLElement>('[data-learning-reveal]')
    gsap.fromTo(items, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .7, stagger: .05, ease: 'power3.out' })
  }, [])

  const progress = Math.round((completed.length / modules.length) * 100)
  const levelCounts = useMemo(() => modules.reduce<Record<string, number>>((acc, m) => { acc[m.level] = (acc[m.level] || 0) + 1; return acc }, {}), [])

  const openModule = (module: Module) => { setSelected(module); setSlide(0); setQuizOpen(false); setQuizIndex(0); setScore(null); setRunningScore(0); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const finishMaterial = () => { setQuizOpen(true); setQuizIndex(0); setScore(null); setRunningScore(0) }
  const answerQuiz = (answer: number) => {
    if (!selected) return
    const correct = answer === selected.quiz[quizIndex].answer
    const nextScore = runningScore + (correct ? 1 : 0)
    if (quizIndex < selected.quiz.length - 1) { setRunningScore(nextScore); setQuizIndex(i => i + 1) }
    else { setRunningScore(nextScore); setScore(nextScore); setCompleted(prev => { const next = prev.includes(selected.id) ? prev : [...prev, selected.id]; localStorage.setItem('kiwantika-learning-progress-v2', JSON.stringify(next)); return next }) }
  }
  const resetQuiz = () => { setQuizIndex(0); setScore(null); setRunningScore(0) }

  if (selected) return <LearningModuleView module={selected} slide={slide} setSlide={setSlide} completed={completed.includes(selected.id)} quizOpen={quizOpen} setQuizOpen={setQuizOpen} quizIndex={quizIndex} score={score} answerQuiz={answerQuiz} resetQuiz={resetQuiz} finishMaterial={finishMaterial} onBack={() => setSelected(null)} />

  return <section ref={pageRef} className="learning-page">
    <div className="learning-hero"><div className="wrap learning-hero-grid">
      <div data-learning-reveal><span className="eyebrow">KIWANTIKA · BELAJAR PRAMUKA</span><h1>Pramuka, tapi<br/><em>lebih visual.</em></h1><p>Modul bertingkat dari kode kehormatan, sandi, semaphore, kompas-peta, tali-temali, hingga pembinaan. Setiap materi diringkas dari sumber yang dapat diverifikasi.</p><div className="learning-hero-actions"><a className="btn primary" href="#materi">Jelajahi materi <ChevronRight size={17}/></a><Link className="btn secondary" to="/">Kembali ke KIWANTIKA</Link></div></div>
      <div className="learning-hero-art" data-learning-reveal><div className="learning-orbit orbit-a"/><div className="learning-orbit orbit-b"/><img src="/media/kiwantika-logo.png" alt="Lambang KIWANTIKA"/><span className="learning-art-label">LEARNING<br/>BY DOING</span></div>
    </div></div>

    <div className="wrap learning-progress" data-learning-reveal><div><span className="eyebrow">PROGRES BELAJAR</span><strong>{completed.length} / {modules.length} modul</strong></div><div className="learning-progress-track" aria-label={`${progress}% selesai`}><span style={{ width: `${progress}%` }}/></div><span className="learning-progress-number">{progress}%</span></div>

    <InteractivePramukaLab />

    <section className="section learning-visual-lab" id="visual"><div className="wrap">
      <div className="learning-section-head" data-learning-reveal><div><span className="eyebrow">VISUAL LAB · KETERAMPILAN</span><h2>Belajar dengan<br/><em>melihat pola.</em></h2></div><p>Visual bukan dekorasi. Ia menjadi alat bantu berpikir: arah untuk semaphore, titik-garis untuk Morse, pasangan huruf untuk AN/AZ, geometri untuk sandi kotak, komponen untuk kompas, kontur untuk peta, dan struktur untuk tali-temali.</p></div>
      <div className="learning-visual-grid">
        <VisualCard wide eyebrow="01 · SEMAPHORE" title="Alfabet A–Z" text="Pasangan posisi tangan dibaca sebagai pola ruang. Roda 8 arah membantu membangun peta mental sebelum latihan." image={VISUAL.semaphore} alt="Diagram alfabet semaphore A sampai Z" meta={['8 arah', '45°', 'A–Z']} />
        <VisualCard eyebrow="02 · SUDUT" title="Semaphore wheel" text="Delapan arah dengan interval 45° dapat dipetakan menggunakan posisi jam sebagai mnemonic." image={VISUAL.semaphoreAngle} alt="Roda sudut semaphore" meta={['12:00', '1:30', '3:00', '…']} />
        <VisualCard eyebrow="03 · MORSE" title="Titik & garis" text="Chart visual membantu siswa membandingkan panjang dan pola karakter." image={VISUAL.morse} alt="Tabel kode Morse" meta={['dot', 'dash', 'A–Z', '0–9']} />
        <VisualCard eyebrow="04 · KOMPAS" title="Anatomi kompas" text="Kenali jarum magnetik, bezel, baseplate, garis indeks, dan panah orientasi sebelum membaca arah." image={VISUAL.compass} alt="Ilustrasi kompas" meta={['arah', 'derajat', 'jarum']} />
        <VisualCard eyebrow="05 · KOMPONEN" title="Bedah kompas" text="Setiap bagian punya fungsi. Diagram ini membantu siswa memahami alat sebelum latihan orientasi." image={VISUAL.compassParts} alt="Diagram komponen kompas" meta={['bezel', 'needle', 'baseplate']} />
        <VisualCard eyebrow="06 · PETA" title="Kontur & skala" text="Peta bukan gambar biasa: simbol, legenda, skala, dan kontur menyampaikan informasi ruang." image={VISUAL.map} alt="Ilustrasi peta kontur" meta={['legend', 'scale', 'contour']} />
        <VisualCard eyebrow="07 · TALI-TEMALI" title="Anatomi simpul" text="Mulai dari bentuk dan fungsi, lalu praktik bersama pembina dengan pemeriksaan keselamatan." image={VISUAL.rope} alt="Ilustrasi tali dan simpul" meta={['simpul', 'ikatan', 'pionering']} />
        <VisualCard eyebrow="08 · SANDI" title="AN & AZ" text="Dua deret alfabet menjadi peta pasangan. Siswa belajar membaca kunci sebelum memecahkan pesan." image={VISUAL.sandiAnAz} alt="Diagram sandi AN dan AZ" meta={['A=N', 'A=Z', 'substitusi']} />
        <VisualCard eyebrow="09 · KOTAK" title="Kotak 1 · 2 · 3" text="Geometri, posisi, dan titik menjadi simbol. Kunci latihan harus dibaca sebelum decoding." image={VISUAL.sandiKotak} alt="Diagram Sandi Kotak 1 2 dan 3" meta={['grid', 'geometri', 'kunci']} />
        <VisualCard eyebrow="10 · ANGKA" title="Alfabet ke nomor" text="Pemetaan A=1 sampai Z=26 menjadi latihan substitusi yang bisa diuji dengan konteks." image={VISUAL.sandiAngka} alt="Diagram sandi angka" meta={['A=1', 'Z=26', 'pola']} />
      </div>
      <div className="learning-visual-sources" data-learning-reveal><span>Rujukan visual:</span><a href="https://commons.wikimedia.org/wiki/File:Semaphore_Signals_A-Z.svg" target="_blank" rel="noreferrer">Semaphore A–Z · CC0</a><span>·</span><a href="https://commons.wikimedia.org/wiki/File:International_Morse_Code.svg" target="_blank" rel="noreferrer">International Morse · Commons</a><span>·</span><a href="https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Penggalang.pdf" target="_blank" rel="noreferrer">SKU Penggalang · Kwarnas</a></div>
    </div></section>

    <section className="section learning-curriculum" id="materi"><div className="wrap"><div className="learning-section-head" data-learning-reveal><div><span className="eyebrow">KURIKULUM · VERIFIED FIRST</span><h2>Lebih dalam.<br/><em>Lebih terstruktur.</em></h2></div><p>Modul kini mencakup jalur konseptual dan keterampilan. Setiap topik penting memiliki rujukan primer atau sumber visual berlisensi jelas.</p></div><div className="learning-level-strip" data-learning-reveal>{Object.entries(levelCounts).map(([key, value]) => <span key={key}><b>{key}</b><small>{value} modul</small></span>)}</div><div className="learning-module-grid">{modules.map((module, index) => <button key={module.id} className={`learning-module-card ${module.color} ${completed.includes(module.id) ? 'is-complete' : ''}`} data-learning-reveal onClick={() => openModule(module)}><span className="learning-card-number">{String(index + 1).padStart(2,'0')}</span><span className="learning-card-level">{module.level}</span>{completed.includes(module.id) ? <Check className="learning-card-check" size={18}/> : <BookOpen className="learning-card-icon" size={20}/>}<h3>{module.title}</h3><p>{module.subtitle}</p><footer><span><Clock3 size={14}/>{module.duration}</span><span>Pelajari <ChevronRight size={15}/></span></footer></button>)}</div></div></section>

    <section className="learning-source-note"><div className="wrap"><Layers3 size={22}/><div><strong>Verified-first learning</strong><p>Konten diringkas dari arsip Kwarnas dan sumber visual yang lisensinya dapat diperiksa. Rumusan resmi lengkap tetap berada di dokumen sumber; KIWANTIKA tidak mengarang butir SKU.</p></div><a href={OFFICIAL.rules} target="_blank" rel="noreferrer">Arsip Kwarnas <ExternalLink size={15}/></a></div></section>
  </section>
}


function VisualCard({ wide, eyebrow, title, text, image, alt, meta }: { wide?: boolean; eyebrow: string; title: string; text: string; image: string; alt: string; meta: string[] }) {
  return <article className={`learning-visual-card ${wide ? 'learning-visual-card-wide' : ''}`} data-learning-reveal><div className="learning-visual-copy"><span className="eyebrow">{eyebrow}</span><h3>{title}</h3><p>{text}</p><div className="learning-visual-meta">{meta.map(item => <span key={item}>{item}</span>)}</div></div><div className="learning-visual-image"><img src={image} alt={alt} loading="lazy"/></div></article>
}

function LearningModuleView(props: { module: Module; slide: number; setSlide: (v:number)=>void; completed:boolean; quizOpen:boolean; setQuizOpen:(v:boolean)=>void; quizIndex:number; score:number|null; answerQuiz:(v:number)=>void; resetQuiz:()=>void; finishMaterial:()=>void; onBack:()=>void }) {
  const { module, slide, setSlide, completed, quizOpen, setQuizOpen, quizIndex, score, answerQuiz, resetQuiz, finishMaterial, onBack } = props
  const current = module.slides[slide]
  return <section className="learning-module-view"><div className="learning-module-top"><div className="wrap"><button className="learning-back" onClick={onBack}><ChevronLeft size={18}/> Semua materi</button><span>{module.level} · {module.title}</span></div></div>{!quizOpen ? <div className="wrap learning-slide-shell"><div className="learning-slide-progress"><span>{String(slide + 1).padStart(2,'0')}</span><div><i style={{width:`${((slide+1)/module.slides.length)*100}%`}}/></div><span>{String(module.slides.length).padStart(2,'0')}</span></div><article className={`learning-slide ${module.color} ${current.visual ? 'has-visual' : ''}`}><div className="learning-slide-index">KIWANTIKA / {String(slide + 1).padStart(2,'0')}</div><div className="learning-slide-copy"><span className="eyebrow">{current.eyebrow}</span><h1>{current.title}</h1><p>{current.body}</p>{current.points && <ul>{current.points.map(point => <li key={point}><Check size={16}/>{point}</li>)}</ul>}</div>{current.visual && <div className="learning-slide-visual"><img src={current.visual} alt={current.visualAlt || ''}/></div>}<div className="learning-slide-source"><span>Sumber terverifikasi</span><a href={module.source.url} target="_blank" rel="noreferrer">{module.source.label} <ExternalLink size={14}/></a>{module.secondarySource && <a href={module.secondarySource.url} target="_blank" rel="noreferrer">Referensi pembanding · {module.secondarySource.label} <ExternalLink size={14}/></a>}</div></article><div className="learning-slide-actions"><button className="btn secondary" disabled={slide===0} onClick={()=>setSlide(slide-1)}><ChevronLeft size={17}/> Sebelumnya</button>{slide<module.slides.length-1?<button className="btn primary" onClick={()=>setSlide(slide+1)}>Lanjut <ChevronRight size={17}/></button>:<button className="btn primary" onClick={finishMaterial}>{completed?'Ulangi materi · buka quiz':'Selesaikan materi · mulai quiz'} <Sparkles size={16}/></button>}</div></div> : <div className="wrap learning-quiz-shell"><div className="learning-quiz-head"><span className="eyebrow">QUIZ · {module.level.toUpperCase()}</span><h1>{score===null?'Uji pemahamanmu.':'Hasil belajarmu.'}</h1><p>{score===null?'Jawab berdasarkan materi dan sumber yang baru dipelajari.':'Quiz ini mengukur pemahaman, bukan menggantikan penilaian pembina atau pencapaian SKU.'}</p></div>{score===null ? <article className="learning-quiz-card"><div className="learning-quiz-count">Pertanyaan {quizIndex+1} / {module.quiz.length}</div><h2>{module.quiz[quizIndex].q}</h2><div className="learning-options">{module.quiz[quizIndex].options.map((option, index)=><button key={option} onClick={()=>answerQuiz(index)}><span>{String.fromCharCode(65+index)}</span>{option}</button>)}</div></article> : <article className="learning-result"><div className="learning-result-icon"><Trophy size={30}/></div><span className="eyebrow">SELESAI</span><h2>{score} / {module.quiz.length}</h2><p>{score===module.quiz.length?'Mantap. Pemahamanmu sangat baik.':score>=Math.ceil(module.quiz.length/2)?'Bagus. Baca ulang bagian yang masih keliru.':'Tidak apa-apa. Ulangi materi dan coba lagi.'}</p><div className="learning-result-actions"><button className="btn secondary" onClick={resetQuiz}><RotateCcw size={16}/> Ulangi quiz</button><button className="btn primary" onClick={onBack}>Pilih materi lain <ChevronRight size={16}/></button></div><div className="learning-explanations">{module.quiz.map((q,i)=><div key={q.q}><strong>{i+1}. {q.options[q.answer]}</strong><p>{q.explanation}</p></div>)}</div></article>}{score===null && <button className="learning-quiz-back" onClick={()=>setQuizOpen(false)}><ChevronLeft size={16}/> Kembali ke materi</button>}</div>}</section>
}

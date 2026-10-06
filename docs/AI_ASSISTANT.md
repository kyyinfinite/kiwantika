# Tunas — asisten AI KIWANTIKA

Endpoint: `POST /api/chat` (Vercel Function, file `api/chat.ts`). Widget: `src/features/assistant/`.

## Model
- Utama: `nvidia/nemotron-3-super-120b-a12b` (terbukti jalan lewat curl dengan kunci proyek). Fungsi mengirim `enable_thinking: false` agar jawaban langsung muncul tanpa fase berpikir; jika parameter itu ditolak, otomatis diulang tanpa parameter.
- Cadangan berurutan: `meta/llama-3.3-70b-instruct`, lalu `meta/llama-3.1-70b-instruct`. Dipakai jika model gagal, tidak ada, kena batas, atau tidak menghasilkan teks.
- Atur urutan lewat `NVIDIA_MODELS` (dipisah koma) tanpa mengubah kode.

## Setup di Vercel
1. Buat API key di build.nvidia.com (Settings, API Keys). Formatnya `nvapi-...`.
2. Project Settings, Environment Variables, tambahkan `NVIDIA_API_KEY` untuk Production dan Preview. Jangan memakai awalan `VITE_`, karena itu akan membocorkan kunci ke browser.
3. Opsional: `ALLOWED_ORIGINS` (origin tambahan dipisah koma), `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` untuk rate limit terpusat.
4. Redeploy. Fungsi otomatis membaca `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` untuk mengambil agenda dan berita publik (cache 5 menit).

## Pengaman bawaan
- Hanya menerima permintaan dari domain situs sendiri (header Origin), plus `ALLOWED_ORIGINS`.
- Rate limit per IP: 8 per menit dan 50 per jam. Tanpa Upstash, hitungan disimpan di memori tiap instance, jadi hanya perkiraan.
- Maksimal 10 pesan riwayat, 800 karakter per pesan, 4000 karakter total, 700 token jawaban.
- Kunci API hanya ada di server dan tidak pernah dikirim ke browser.
- Pesan error ke pengguna tidak membocorkan detail upstream.

## Uji cepat setelah deploy
```bash
curl -N https://DOMAIN/api/chat -H 'Content-Type: application/json' -H 'Origin: https://DOMAIN' -d '{"messages":[{"role":"user","content":"Halo"}]}'
```

## Dev dari Termux (tanpa Vercel CLI)
Isi `AI_DEV_PROXY=https://DOMAIN-VERCEL-KAMU` di `.env`, lalu `npm run dev`. Permintaan `/api` diteruskan ke deployment, jadi kunci NVIDIA tidak perlu ada di perangkat.

## Batas penting
- build.nvidia.com menyediakan endpoint gratis untuk uji coba dan prototipe di bawah NVIDIA API Trial Terms. Batas laju dan ketersediaan model bisa berubah. Untuk produksi jangka panjang, baca syarat terbaru NVIDIA.
- Kepribadian dan batasan Tunas diatur di fungsi `buildSystemPrompt` pada `api/chat.ts`.

# KIWANTIKA

Portal digital Ambalan Ki Hajar Dewantara – Dewi Sartika, SMAN 10 Garut.

## Teknologi

- React
- TypeScript
- Vite
- Supabase

## Menjalankan secara lokal

Persyaratan: Node.js versi 20.19 atau lebih baru dan npm.

1. Pasang dependensi:

   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env`, lalu isi variabel yang diperlukan.

3. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

## Build produksi

```bash
npm run build
```

Hasil build tersedia di direktori `dist/`.

## Pengujian

```bash
npm run test:tunas
npm run test:exports
```

## Deployment

Konfigurasi deployment Vercel tersedia di `vercel.json`.

Pastikan variabel lingkungan telah diatur pada lingkungan deployment. Jangan commit file `.env` atau kredensial rahasia ke repository.

# Smart RT

PWA administrasi RT — Foundation V1.

## Stack
React + TypeScript + Vite + Tailwind CSS + Supabase.

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada `.env` menggunakan nilai project Supabase. Jangan pernah mengunggah service role key atau data warga pribadi ke repository.

## Database
Jalankan SQL migration di `supabase/migrations/001_foundation.sql` melalui Supabase SQL Editor. Setelahnya, buat Super Admin pertama melalui Supabase Auth lalu tetapkan role menggunakan SQL admin yang dijalankan secara manual melalui SQL Editor (bukan dari browser).

## Status
- Foundation scaffold dan halaman autentikasi/registrasi
- Data rumah + approval memakai Supabase dan RLS
- Belum deploy Cloudflare Pages
- Belum aktif untuk transaksi keuangan

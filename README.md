# Smart RT — Foundation V1

Aplikasi administrasi RT berbasis PWA untuk 50–100 rumah, maksimal dua akun warga aktif per rumah.

## Stack
- React + TypeScript + Vite + Tailwind CSS
- Supabase Auth, PostgreSQL, RLS
- Cloudflare Pages (rencana deployment)

## Menjalankan secara lokal
1. Install Node.js 20.19+ / 22.12+
2. Jalankan `npm install`
3. Salin `.env.example` ke `.env`
4. Isikan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (gunakan public/anon key, **bukan** service role key)
5. Jalankan `npm run dev`

## Siapkan Supabase
1. Buat project baru di Supabase.
2. Buka SQL Editor dan jalankan `supabase/migrations/001_foundation.sql` **sekali**.
3. Jika konfirmasi email diaktifkan di Supabase Auth, pengguna harus verifikasi email sebelum login.
4. Buat akun administrator pertama melalui halaman pendaftaran dan verifikasi email.
5. Melalui **Supabase SQL Editor** sebagai admin database, berikan role dengan mengganti email pada perintah berikut:

```sql
insert into public.role_assignments(user_id, role)
select id, 'super_admin'
from auth.users
where email = 'GANTI_DENGAN_EMAIL_ADMIN'
on conflict do nothing;
```

6. Login kembali sebagai Super Admin dan buat master rumah di Data Warga.
7. Warga lain dapat mendaftar, lalu setelah login melengkapi data rumah dan meminta persetujuan.

**Penting:** pastikan akun Super Admin pertama sudah diatur dan master rumah tersedia sebelum mengundang warga. Jangan menjalankan SQL bootstrap dari frontend.

## Deploy ke Cloudflare Pages
- Hubungkan repository `desianggarawati/smart-rt` ke Pages
- Build command: `npm run build`
- Output directory: `dist`
- Tambahkan environment variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
- Masukkan domain Pages ke URL Configuration (Site URL / Redirect URLs) Supabase Auth

## Sudah tersedia di source code
- Login dan sign-up email/password
- Registrasi setelah login dan verifikasi email
- Super Admin: master rumah, melihat warga, approval/reject pendaftaran
- Maksimal 2 akun warga aktif/rumah (diterapkan di transaksi SQL)
- Dashboard role-aware
- Menu Kas RT tidak muncul untuk penghuni kontrak
- RLS membatasi akses direktori warga, registrasi, role, dan audit log

## Masih perlu dikembangkan
- **Belum terhubung ke Supabase project riil** dan **belum diuji end-to-end**
- Registrasi dan approval perlu QA pada Supabase project riil
- Kas RT, IPL, iuran tambahan, PKK, arisan, chat, kalender dinamis, push
- PWA offline caching/service worker dan ikon PNG lintas perangkat
- Data pembayaran dan ledger, approval tarif, backup, serta testing security

Repository ini belum boleh dipakai untuk memproses pembayaran atau data pribadi warga sebelum validasi keamanan dan pengujian.

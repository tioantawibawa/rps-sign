# Deploy RPS Sign gratis (Render + Neon + Cloudflare R2)

Panduan hosting RPS Sign agar bisa diakses via internet **tanpa biaya**, dengan
fitur penuh (termasuk konversi DOCX→PDF, karena app dijalankan sebagai container
Docker yang sudah memasang LibreOffice).

## Arsitektur hosting

| Komponen | Layanan gratis | Fungsi |
|---|---|---|
| Aplikasi (Docker) | **Render** Web Service | Menjalankan Next.js + LibreOffice |
| Database | **Neon** PostgreSQL | Data aplikasi (gratis permanen) |
| Object storage | **Cloudflare R2** | File dokumen & tanda tangan (S3-compatible) |
| Email | `console` (default) | Email dicatat di log; opsional ganti SMTP |

> **Catatan tier gratis Render:** service akan "tidur" setelah ~15 menit tanpa
> trafik, sehingga request pertama setelah idle butuh ~30–60 detik (cold start).
> Wajar untuk demo/internal.

---

## 1. Siapkan Database (Neon)

1. Daftar di https://neon.tech (bisa login pakai GitHub).
2. Create project → pilih region terdekat (mis. Singapore).
3. Salin **connection string** (format `postgresql://user:pass@host/dbname`).
4. Pastikan diakhiri `?sslmode=require`, contoh:
   ```
   postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/rps_sign?sslmode=require
   ```
   Simpan sebagai `DATABASE_URL`.

## 2. Siapkan Storage (Cloudflare R2)

1. Masuk https://dash.cloudflare.com → **R2** → aktifkan (perlu verifikasi kartu,
   tapi ada free tier 10 GB tanpa biaya egress).
2. **Create bucket**, mis. `rps-sign`. → ini `S3_BUCKET`.
3. Menu R2 → **Manage R2 API Tokens** → **Create API token**:
   - Permission: **Object Read & Write**, scope ke bucket tadi.
   - Salin **Access Key ID** → `S3_ACCESS_KEY_ID`
   - Salin **Secret Access Key** → `S3_SECRET_ACCESS_KEY`
4. Endpoint R2 (`S3_ENDPOINT`) berbentuk:
   ```
   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```
   `<ACCOUNT_ID>` bisa dilihat di halaman R2 (kanan atas / detail bucket).
5. Untuk R2: `S3_REGION=auto` dan `S3_FORCE_PATH_STYLE=true` (sudah diatur di
   `render.yaml`).

> App tidak pernah membuka file langsung dari R2 ke browser. File diambil oleh
> server lalu diserahkan lewat endpoint bertanda tangan HMAC (`/api/files/download`),
> jadi bucket cukup **privat** — jangan diset publik.

## 3. Inisialisasi skema DB + akun demo (dari komputermu)

Proyek ini memakai `prisma db push` (belum ada folder migrations), dan runner
image sengaja minimal tanpa Prisma CLI. Jadi jalankan sekali dari komputermu ke
Neon (Neon dapat diakses publik):

**PowerShell (Windows):**
```powershell
$env:DATABASE_URL="postgresql://...neon.../rps_sign?sslmode=require"
npm install
npx prisma db push
npm run db:seed   # membuat akun demo + mencetak tautan verifikasi
```

> Jika belum punya `pnpm`, pakai `npm` seperti di atas. `npm install` diperlukan
> agar `tsx` (dipakai oleh `db:seed`) tersedia. Deploy di Render tetap memakai
> Docker, jadi pilihan npm/pnpm di sini hanya untuk komputermu.

`npm run db:seed` mencetak akun demo (password: `Password123!`).
**Untuk produksi nyata, hapus/ganti akun demo ini.**

## 4. Deploy ke Render

1. Push repo ini ke GitHub (lihat bagian bawah).
2. Daftar di https://render.com (login pakai GitHub).
3. **New → Blueprint** → pilih repo ini. Render membaca `render.yaml` dan membuat
   Web Service Docker otomatis.
4. Render meminta nilai variabel `sync: false`. Isi:

   | Variabel | Nilai |
   |---|---|
   | `DATABASE_URL` | connection string Neon (langkah 1) |
   | `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
   | `S3_ACCESS_KEY_ID` | dari R2 (langkah 2) |
   | `S3_SECRET_ACCESS_KEY` | dari R2 (langkah 2) |
   | `S3_BUCKET` | nama bucket, mis. `rps-sign` |
   | `APP_URL` | *(kosongkan dulu — lihat langkah 5)* |
   | `NEXT_PUBLIC_APP_URL` | *(kosongkan dulu)* |
   | `AUTH_URL` | *(kosongkan dulu)* |

   `AUTH_SECRET` dibuat otomatis oleh Render.
5. Klik **Apply / Create**. Deploy pertama akan build image Docker (agak lama krn
   memasang LibreOffice). Setelah jadi, kamu dapat URL seperti
   `https://rps-sign.onrender.com`.
6. **Isi 3 URL tadi** dengan URL Render kamu, lalu **redeploy**:
   ```
   APP_URL=https://rps-sign.onrender.com
   NEXT_PUBLIC_APP_URL=https://rps-sign.onrender.com
   AUTH_URL=https://rps-sign.onrender.com
   ```
   (Environment → edit → Save → Manual Deploy.)

## 5. Verifikasi

- Buka `https://<app>.onrender.com/api/health` → harus `ok`.
- Buka halaman utama, login dengan akun demo hasil seed.
- Coba unggah dokumen (DOCX akan dikonversi ke PDF oleh LibreOffice di container).

---

## Checklist keamanan sebelum dipakai serius

- [ ] Hapus/ganti akun demo & password `Password123!`.
- [ ] `AUTH_SECRET` acak kuat (Render `generateValue` sudah memenuhi).
- [ ] Bucket R2 **privat** (bukan public access).
- [ ] Ganti `MAIL_DRIVER=smtp` + isi `SMTP_*` bila perlu email nyata
      (mis. Brevo/Resend punya free tier).
- [ ] Backup DB Neon & bucket R2 secara berkala.

## Alternatif

- **Vercel**: paling mudah untuk Next.js, tapi *tanpa* LibreOffice → konversi
  DOCX otomatis tidak jalan (user harus unggah PDF). Tetap butuh Neon + R2.
- **Fly.io / Koyeb**: juga Docker-based, punya free allowance; alur mirip Render.

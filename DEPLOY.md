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
- **VPS (Biznet Gio / server Linux sendiri)**: lihat bagian di bawah — semua
  komponen jalan di satu server, tanpa Neon/R2.

---

# Deploy ke VPS (Biznet Gio NEO Lite / server Linux mana pun)

Kalau punya VPS/cloud VM, ini cara **paling sederhana**: seluruh stack
(aplikasi + PostgreSQL + MinIO storage + Mailpit + reverse proxy HTTPS) jalan di
satu server lewat Docker Compose. **Tidak perlu Neon maupun Cloudflare R2** —
Postgres & storage jalan sebagai container dengan disk persisten.

## ⚠️ Pilih produk yang benar

- **JANGAN** pakai *NEO Web Hosting* / *NEO WordPress* (itu shared hosting
  PHP/MySQL — tidak bisa menjalankan Node.js, Docker, atau LibreOffice).
- **PAKAI** menu **Compute → NEO Lite** (VM/VPS Linux).

## 1. Buat VM

- OS: **Ubuntu 22.04 LTS**.
- Spesifikasi minimal disarankan: **2 vCPU / 4 GB RAM / 40 GB disk**
  (4 GB penting agar build Next.js + LibreOffice tidak kehabisan memori).
- Catat **IP publik** VM.

## 2. Domain (untuk HTTPS)

Caddy menerbitkan sertifikat HTTPS otomatis, tapi butuh nama domain yang
mengarah ke IP VM.

**Belum punya domain? Pakai DuckDNS (gratis):**
1. Buka https://www.duckdns.org → login (Google/GitHub).
2. Buat subdomain, mis. `rps-sign` → jadi `rps-sign.duckdns.org`.
3. Di kolom **current ip**, isi **IP publik VM**, klik **update ip**.
4. Domain kamu sekarang: `rps-sign.duckdns.org`.

Atau, kalau punya domain sendiri: buat **A record** ke IP publik VM.

## 3. Pasang Docker & Git (via SSH)

```bash
ssh root@<IP-publik-VM>

apt update && apt upgrade -y
apt install -y git ca-certificates curl
curl -fsSL https://get.docker.com | sh    # Docker + compose plugin
```

## 4. Ambil kode & konfigurasi

```bash
git clone https://github.com/tioantawibawa/rps-sign.git
cd rps-sign
git checkout claude/nurma-database-connection-ndhemo

# Simpan variabel produksi ke file .env (dibaca otomatis oleh docker compose).
cat > .env <<EOF
DOMAIN=rps-sign.duckdns.org
AUTH_SECRET=$(openssl rand -base64 32)
EOF
```

> `.env` di server ini hanya berisi `DOMAIN` + `AUTH_SECRET` untuk interpolasi
> Compose. Kredensial Postgres/MinIO internal sudah diatur di
> `docker-compose.yml` dan tidak diekspos ke internet.

## 5. Jalankan seluruh stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Build pertama agak lama (memasang LibreOffice + build Next.js). Pantau dengan:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

## 6. Isi akun demo (sekali saja)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm migrate /bin/sh -c "pnpm exec tsx prisma/seed.ts"
```

## 7. Firewall

Hanya buka port yang diperlukan (Postgres/MinIO/Mailpit TIDAK diekspos):
```bash
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

Buka `https://rps-sign.duckdns.org`. Selesai.

## Operasional

**Update ke versi terbaru:**
```bash
cd rps-sign
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**Lihat status / log:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f app
```

**Backup database:**
```bash
docker compose exec db pg_dump -U rps rps_sign > backup_$(date +%F).sql
```

**Backup file (volume MinIO & DB) juga disarankan** — data ada di Docker volume
`rps-sign_db_data` dan `rps-sign_minio_data`.

## Catatan keamanan (produksi)

- [ ] Hapus/ganti akun demo & password `Password123!`.
- [ ] Ganti `MINIO_ROOT_PASSWORD` & kredensial Postgres di `docker-compose.yml`
      dari nilai default sebelum dipakai serius.
- [ ] Aktifkan backup terjadwal (DB + volume MinIO).
- [ ] `MAIL_DRIVER` diset `smtp` + SMTP nyata bila perlu email keluar
      (default memakai Mailpit internal, UI di `:8025` — jangan diekspos publik).
